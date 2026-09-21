import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { PasswordService } from '../../auth/password.service';
import { AuthenticatedUser } from '../../auth/auth.types';
import { ForbiddenException } from '@nestjs/common';
import { Producto } from '../productos/entities/producto.entity';
import { Categoria } from '../categorias/entities/categoria.entity';
import { Subcategoria } from '../categorias/entities/subcategoria.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { Solicitud, SolicitudEstado } from './entities/solicitud.entity';
import type {
  NewProductPayload,
  ProductDeletionPayload,
  ProductUpdatePayload,
  RegistrationPayload,
  SolicitudPayload,
  VendorUpdatePayload,
} from './solicitud-payload.types';
import { assertAllowedImageUrls } from '../../security/image-url';

export type PublicRegistrationResponse = Pick<
  Solicitud,
  'id' | 'tipo' | 'estado' | 'createdAt'
>;

type SafeSolicitudResponse = Omit<Solicitud, 'payload'> & {
  payload: Record<string, unknown>;
};

@Injectable()
export class SolicitudesService {
  private normalizarRedes(valor: unknown) {
    if (!Array.isArray(valor)) return [];
    return valor.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const { tipo, url } = item as { tipo?: unknown; url?: unknown };
      if (
        !['facebook', 'instagram'].includes(String(tipo)) ||
        typeof url !== 'string' ||
        !/^https?:\/\//i.test(url.trim())
      ) {
        return [];
      }
      return [
        {
          tipo: tipo as 'facebook' | 'instagram',
          url: url.trim(),
        },
      ];
    });
  }

  private normalizarWhatsapp(valor: unknown) {
    if (typeof valor !== 'string') return null;
    const digitos = valor.replace(/\D/g, '');
    return /^549\d{10}$/.test(digitos) ? digitos : null;
  }

  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudesRepository: Repository<Solicitud>,
    @InjectRepository(Vendedor)
    private readonly vendedoresRepository: Repository<Vendedor>,
    @InjectRepository(Producto)
    private readonly productosRepository: Repository<Producto>,
    private readonly passwordService: PasswordService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    createSolicitudDto: CreateSolicitudDto | CreateRegistrationDto,
    requester?: AuthenticatedUser,
  ) {
    if (!createSolicitudDto.tipo) {
      throw new BadRequestException('El tipo de solicitud es obligatorio');
    }

    if (
      !createSolicitudDto.payload ||
      typeof createSolicitudDto.payload !== 'object'
    ) {
      throw new BadRequestException('La solicitud debe incluir datos');
    }

    if (createSolicitudDto.tipo === 'registro_usuario') {
      if (requester)
        throw new BadRequestException('Usa la ruta publica de registro');
      const email = String(createSolicitudDto.payload.email ?? '')
        .trim()
        .toLowerCase();
      if (!email) {
        throw new BadRequestException('El email es obligatorio');
      }

      const existing = await this.vendedoresRepository.findOne({
        where: { email },
      });
      if (existing) {
        throw new ConflictException('El email ya existe');
      }

      const pending = await this.solicitudesRepository.findOne({
        where: {
          tipo: 'registro_usuario',
          estado: 'pendiente',
          solicitanteEmail: email,
        },
      });
      if (pending) {
        throw new ConflictException(
          'Ya existe una solicitud pendiente para ese email',
        );
      }
    }

    if (createSolicitudDto.tipo !== 'registro_usuario') {
      if (!requester) throw new ForbiddenException('Autenticacion requerida');
      this.validateAuthenticatedPayload(createSolicitudDto);
      await this.assertOwnership(createSolicitudDto, requester);
    }

    let payloadForStorage: SolicitudPayload = {
      ...createSolicitudDto.payload,
    } as SolicitudPayload;
    if (
      requester &&
      (createSolicitudDto.tipo === 'actualizacion_datos' ||
        createSolicitudDto.tipo === 'nuevo_producto')
    ) {
      payloadForStorage = {
        ...payloadForStorage,
        vendedorId: requester.sub,
      };
    }
    if (createSolicitudDto.tipo === 'registro_usuario') {
      const { password, ...safePayload } = createSolicitudDto.payload;
      payloadForStorage = {
        ...safePayload,
        passwordHash: await this.passwordService.hash(String(password ?? '')),
      };
    }
    this.assertPayloadImageUrls(payloadForStorage);

    const solicitud = this.solicitudesRepository.create({
      tipo: createSolicitudDto.tipo,
      estado: 'pendiente',
      solicitanteId:
        requester?.sub ??
        ('solicitanteId' in createSolicitudDto
          ? createSolicitudDto.solicitanteId
          : null) ??
        null,
      solicitanteEmail:
        requester?.email ??
        (createSolicitudDto.tipo === 'registro_usuario'
          ? String(createSolicitudDto.payload.email).trim().toLowerCase()
          : (createSolicitudDto.solicitanteEmail ?? null)),
      solicitanteNombre:
        requester?.nombre ?? createSolicitudDto.solicitanteNombre ?? null,
      entidadObjetivo: createSolicitudDto.entidadObjetivo ?? null,
      entidadId:
        'entidadId' in createSolicitudDto
          ? (createSolicitudDto.entidadId ?? null)
          : null,
      payload: payloadForStorage,
    });

    const saved = await this.solicitudesRepository.save(solicitud);
    return createSolicitudDto.tipo === 'registro_usuario'
      ? this.toPublicRegistrationResponse(saved)
      : this.toSafeResponse(saved);
  }

  async findAll(estado?: SolicitudEstado, page = 1, pageSize = 50) {
    const solicitudes = await this.solicitudesRepository.find({
      where: estado ? { estado } : undefined,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return solicitudes.map((solicitud) => this.toSafeResponse(solicitud));
  }

  async approve(id: number, resolverId: number) {
    return this.dataSource.transaction(async (manager) => {
      const solicitudes = manager.getRepository(Solicitud);
      const solicitud = await solicitudes.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
      if (solicitud.estado !== 'pendiente')
        return this.toSafeResponse(solicitud);

      await this.applyApproval(solicitud, manager);
      solicitud.estado = 'aprobada';
      solicitud.resueltoPor = resolverId;
      solicitud.resolvedAt = new Date();
      return this.toSafeResponse(await solicitudes.save(solicitud));
    });
  }

  async reject(id: number, resolverId: number) {
    return this.dataSource.transaction(async (manager) => {
      const solicitudes = manager.getRepository(Solicitud);
      const solicitud = await solicitudes.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
      if (solicitud.estado !== 'pendiente')
        return this.toSafeResponse(solicitud);

      solicitud.estado = 'rechazada';
      solicitud.resueltoPor = resolverId;
      solicitud.resolvedAt = new Date();
      return this.toSafeResponse(await solicitudes.save(solicitud));
    });
  }

  private toPublicRegistrationResponse(
    solicitud: Solicitud,
  ): PublicRegistrationResponse {
    const { id, tipo, estado, createdAt } = solicitud;
    return { id, tipo, estado, createdAt };
  }

  private toSafeResponse(solicitud: Solicitud): SafeSolicitudResponse {
    const payload = Object.fromEntries(
      Object.entries(solicitud.payload as Record<string, unknown>).filter(
        ([key]) => !['password', 'passwordHash'].includes(key),
      ),
    );
    return { ...solicitud, payload };
  }

  private async applyApproval(solicitud: Solicitud, manager: EntityManager) {
    const vendedores = manager.getRepository(Vendedor);
    const productos = manager.getRepository(Producto);
    switch (solicitud.tipo) {
      case 'registro_usuario': {
        const payload = solicitud.payload as RegistrationPayload;
        const email = String(payload.email ?? '').trim();
        if (!email) {
          throw new BadRequestException('La solicitud no contiene email');
        }

        const existing = await vendedores.findOne({ where: { email } });
        if (existing) {
          throw new ConflictException('El email ya existe');
        }

        await vendedores.save(
          vendedores.create({
            nombre: String(payload.nombre ?? ''),
            email,
            rol: 'usuario',
            estadoSolicitud: 'aprobado',
            ruess: payload.ruess ?? null,
            esMonotributista: payload.esMonotributista ?? null,
            descripcionNegocio: payload.descripcionNegocio ?? null,
            integrantesEquipo: payload.integrantesEquipo ?? [],
            ubicacion: payload.ubicacion ?? null,
            whatsapp: this.normalizarWhatsapp(payload.whatsapp),
            telefono: payload.telefono ?? null,
            redesSociales: this.normalizarRedes(payload.redesSociales),
            passwordHash: payload.passwordHash,
          }),
        );
        break;
      }
      case 'actualizacion_datos': {
        const payload = solicitud.payload as VendorUpdatePayload;
        const vendedorId = Number(payload.vendedorId);
        const vendedor = await vendedores.findOne({
          where: { id: vendedorId },
        });
        if (!vendedor) {
          throw new NotFoundException('Usuario no encontrado');
        }

        if (payload.nombre !== undefined) {
          vendedor.nombre = String(payload.nombre);
        }
        if (payload.ruess !== undefined) {
          vendedor.ruess = payload.ruess ? String(payload.ruess) : null;
        }
        if (payload.esMonotributista !== undefined) {
          vendedor.esMonotributista = payload.esMonotributista;
        }
        if (payload.descripcionNegocio !== undefined) {
          vendedor.descripcionNegocio = payload.descripcionNegocio
            ? String(payload.descripcionNegocio)
            : null;
        }
        if (payload.integrantesEquipo !== undefined) {
          vendedor.integrantesEquipo = Array.isArray(payload.integrantesEquipo)
            ? payload.integrantesEquipo
            : [];
        }
        if (payload.ubicacion !== undefined) {
          vendedor.ubicacion = payload.ubicacion
            ? String(payload.ubicacion)
            : null;
        }
        if (payload.whatsapp !== undefined) {
          vendedor.whatsapp = this.normalizarWhatsapp(payload.whatsapp);
        }
        if (payload.telefono !== undefined) {
          vendedor.telefono = payload.telefono
            ? String(payload.telefono)
            : null;
        }
        if (payload.redesSociales !== undefined) {
          vendedor.redesSociales = this.normalizarRedes(payload.redesSociales);
        }

        await vendedores.save(vendedor);
        break;
      }
      case 'nuevo_producto': {
        const payload = solicitud.payload as NewProductPayload;
        this.assertPayloadImageUrls(payload);
        const vendedorId = Number(payload.vendedorId);
        const vendedor = await vendedores.findOne({
          where: { id: vendedorId },
        });
        if (!vendedor) {
          throw new NotFoundException('Vendedor no encontrado');
        }

        const categoria = await manager.getRepository(Categoria).findOne({
          where: {
            nombre: String(payload.categoria ?? '').trim(),
            activa: true,
          },
        });
        if (!categoria)
          throw new BadRequestException(
            'La categoría seleccionada no existe o no está activa.',
          );
        const subcategoria = payload.subcategoria
          ? await manager.getRepository(Subcategoria).findOne({
              where: {
                nombre: String(payload.subcategoria).trim(),
                categoriaId: categoria.id,
              },
            })
          : null;
        if (payload.subcategoria && !subcategoria)
          throw new BadRequestException(
            'La subcategoría no pertenece a la categoría indicada.',
          );
        await productos.save(
          productos.create({
            nombre: String(payload.nombre ?? ''),
            descripcion: String(payload.descripcion ?? ''),
            categoria: categoria.nombre,
            categoriaId: categoria.id,
            subcategoria: subcategoria?.nombre ?? null,
            subcategoriaId: subcategoria?.id ?? null,
            imagenUrl: payload.imagenUrl ? String(payload.imagenUrl) : null,
            imagenUrl2: payload.imagenUrl2 ? String(payload.imagenUrl2) : null,
            imagenUrl3: payload.imagenUrl3 ? String(payload.imagenUrl3) : null,
            imagenUrl4: payload.imagenUrl4 ? String(payload.imagenUrl4) : null,
            vendedorId: vendedor.id,
          }),
        );
        break;
      }
      case 'actualizacion_producto': {
        const payload = solicitud.payload as ProductUpdatePayload;
        this.assertPayloadImageUrls(payload);
        const productoId = Number(payload.productoId);
        const producto = await productos.findOne({ where: { id: productoId } });
        if (!producto) {
          throw new NotFoundException('Producto no encontrado');
        }

        if (payload.nombre !== undefined) {
          producto.nombre = String(payload.nombre);
        }
        if (payload.descripcion !== undefined) {
          producto.descripcion = String(payload.descripcion);
        }
        if (payload.categoria !== undefined) {
          const categoria = await manager.getRepository(Categoria).findOne({
            where: { nombre: String(payload.categoria).trim(), activa: true },
          });
          if (!categoria) {
            throw new BadRequestException(
              'La categoría seleccionada no existe o no está activa.',
            );
          }
          producto.categoria = categoria.nombre;
          producto.categoriaId = categoria.id;
        }
        if (payload.subcategoria !== undefined) {
          const subcategoria = payload.subcategoria
            ? await manager.getRepository(Subcategoria).findOne({
                where: {
                  nombre: String(payload.subcategoria).trim(),
                  categoriaId: producto.categoriaId,
                },
              })
            : null;
          if (payload.subcategoria && !subcategoria)
            throw new BadRequestException(
              'La subcategoría no pertenece a la categoría indicada.',
            );
          producto.subcategoria = subcategoria?.nombre ?? null;
          producto.subcategoriaId = subcategoria?.id ?? null;
        } else if (payload.categoria !== undefined) {
          producto.subcategoria = null;
          producto.subcategoriaId = null;
        }
        if (payload.imagenUrl !== undefined) {
          producto.imagenUrl = payload.imagenUrl
            ? String(payload.imagenUrl)
            : null;
        }
        if (payload.imagenUrl2 !== undefined) {
          producto.imagenUrl2 = payload.imagenUrl2
            ? String(payload.imagenUrl2)
            : null;
        }
        if (payload.imagenUrl3 !== undefined) {
          producto.imagenUrl3 = payload.imagenUrl3
            ? String(payload.imagenUrl3)
            : null;
        }
        if (payload.imagenUrl4 !== undefined) {
          producto.imagenUrl4 = payload.imagenUrl4
            ? String(payload.imagenUrl4)
            : null;
        }

        await productos.save(producto);
        break;
      }
      case 'eliminacion_producto': {
        const payload = solicitud.payload as ProductDeletionPayload;
        const producto = await productos.findOne({
          where: { id: Number(payload.productoId) },
        });
        if (!producto) {
          throw new NotFoundException('Producto no encontrado');
        }
        await productos.remove(producto);
        break;
      }
      default:
        throw new BadRequestException('Tipo de solicitud no soportado');
    }
  }

  private async assertOwnership(
    dto: CreateSolicitudDto,
    requester: AuthenticatedUser,
  ) {
    if (requester.rol === 'administrador') return;
    const payload = dto.payload;
    if (dto.tipo === 'actualizacion_datos' || dto.tipo === 'nuevo_producto') {
      return;
    }
    if (
      dto.tipo === 'actualizacion_producto' ||
      dto.tipo === 'eliminacion_producto'
    ) {
      const producto = await this.productosRepository.findOne({
        where: { id: Number(payload.productoId) },
      });
      if (!producto || producto.vendedorId !== requester.sub) {
        throw new ForbiddenException('No podes gestionar un producto ajeno');
      }
    }
  }

  private validateAuthenticatedPayload(dto: CreateSolicitudDto) {
    const payload = dto.payload;
    if (
      dto.tipo === 'actualizacion_datos' &&
      payload.redesSociales !== undefined
    ) {
      if (!Array.isArray(payload.redesSociales)) {
        throw new BadRequestException('Las redes sociales deben ser una lista');
      }
      const redes = this.normalizarRedes(payload.redesSociales);
      if (redes.length !== payload.redesSociales.length) {
        throw new BadRequestException(
          'Cada red debe ser Facebook o Instagram e incluir un enlace HTTP(S) válido',
        );
      }
    }
    if (dto.tipo === 'nuevo_producto') {
      if (!payload.nombre || !payload.descripcion || !payload.categoria) {
        throw new BadRequestException(
          'Nombre, descripcion y categoria son obligatorios',
        );
      }
    }

    if (
      (dto.tipo === 'actualizacion_producto' ||
        dto.tipo === 'eliminacion_producto') &&
      !payload.productoId
    ) {
      throw new BadRequestException('El productoId es obligatorio');
    }
  }

  private assertPayloadImageUrls(payload: SolicitudPayload) {
    const candidate = payload as Partial<NewProductPayload>;
    assertAllowedImageUrls([
      candidate.imagenUrl,
      candidate.imagenUrl2,
      candidate.imagenUrl3,
      candidate.imagenUrl4,
    ]);
  }
}
