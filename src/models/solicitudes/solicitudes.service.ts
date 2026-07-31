import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { Repository } from 'typeorm';
import { Producto } from '../productos/entities/producto.entity';
import { Vendedor } from '../vendedores/entities/vendedore.entity';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { Solicitud, SolicitudEstado, SolicitudTipo } from './entities/solicitud.entity';

@Injectable()
export class SolicitudesService {
	constructor(
		@InjectRepository(Solicitud)
		private readonly solicitudesRepository: Repository<Solicitud>,
		@InjectRepository(Vendedor)
		private readonly vendedoresRepository: Repository<Vendedor>,
		@InjectRepository(Producto)
		private readonly productosRepository: Repository<Producto>,
	) {}

	private hashPassword(password: string) {
		return createHash('sha256').update(password).digest('hex');
	}

	async create(createSolicitudDto: CreateSolicitudDto) {
		if (!createSolicitudDto.tipo) {
			throw new BadRequestException('El tipo de solicitud es obligatorio');
		}

		if (!createSolicitudDto.payload || typeof createSolicitudDto.payload !== 'object') {
			throw new BadRequestException('La solicitud debe incluir datos');
		}

		if (createSolicitudDto.tipo === 'registro_usuario') {
			const email = String(createSolicitudDto.payload.email ?? '').trim().toLowerCase();
			if (!email) {
				throw new BadRequestException('El email es obligatorio');
			}

			const existing = await this.vendedoresRepository.findOne({ where: { email } });
			if (existing) {
				throw new ConflictException('El email ya existe');
			}

			const pending = await this.solicitudesRepository.findOne({
				where: { tipo: 'registro_usuario', estado: 'pendiente', solicitanteEmail: email },
			});
			if (pending) {
				throw new ConflictException('Ya existe una solicitud pendiente para ese email');
			}
		}

		const solicitud = this.solicitudesRepository.create({
			tipo: createSolicitudDto.tipo,
			estado: 'pendiente',
			solicitanteId: createSolicitudDto.solicitanteId ?? null,
			solicitanteEmail: createSolicitudDto.solicitanteEmail ?? null,
			solicitanteNombre: createSolicitudDto.solicitanteNombre ?? null,
			entidadObjetivo: createSolicitudDto.entidadObjetivo ?? null,
			entidadId: createSolicitudDto.entidadId ?? null,
			payload: createSolicitudDto.payload,
		});

		return this.solicitudesRepository.save(solicitud);
	}

	findAll(estado?: SolicitudEstado) {
		return this.solicitudesRepository.find({
			where: estado ? { estado } : undefined,
			order: { id: 'DESC' },
		});
	}

	async approve(id: number) {
		const solicitud = await this.solicitudesRepository.findOne({ where: { id } });
		if (!solicitud) {
			throw new NotFoundException('Solicitud no encontrada');
		}

		if (solicitud.estado !== 'pendiente') {
			return solicitud;
		}

		await this.applyApproval(solicitud);
		solicitud.estado = 'aprobada';
		solicitud.resueltoPor = null;
		solicitud.resolvedAt = new Date();

		return this.solicitudesRepository.save(solicitud);
	}

	async reject(id: number) {
		const solicitud = await this.solicitudesRepository.findOne({ where: { id } });
		if (!solicitud) {
			throw new NotFoundException('Solicitud no encontrada');
		}

		solicitud.estado = 'rechazada';
		solicitud.resolvedAt = new Date();
		return this.solicitudesRepository.save(solicitud);
	}

	private async applyApproval(solicitud: Solicitud) {
		switch (solicitud.tipo as SolicitudTipo) {
			case 'registro_usuario': {
				const payload = solicitud.payload as Record<string, unknown>;
				const email = String(payload.email ?? '').trim();
				if (!email) {
					throw new BadRequestException('La solicitud no contiene email');
				}

				const existing = await this.vendedoresRepository.findOne({ where: { email } });
				if (existing) {
					throw new ConflictException('El email ya existe');
				}

				await this.vendedoresRepository.save(
					this.vendedoresRepository.create({
						nombre: String(payload.nombre ?? ''),
						email,
						rol: 'usuario',
						estadoSolicitud: 'aprobado',
						ruess: (payload.ruess as string | null | undefined) ?? null,
						descripcionNegocio: (payload.descripcionNegocio as string | null | undefined) ?? null,
						integrantesEquipo: (payload.integrantesEquipo as string[] | undefined) ?? [],
						ubicacion: (payload.ubicacion as string | null | undefined) ?? null,
						whatsapp: (payload.whatsapp as string | null | undefined) ?? null,
						telefono: (payload.telefono as string | null | undefined) ?? null,
						passwordHash: this.hashPassword(String(payload.password ?? '')),
					}),
				);
				break;
			}
			case 'actualizacion_datos': {
				const payload = solicitud.payload as Record<string, unknown>;
				const vendedorId = Number(payload.vendedorId);
				const vendedor = await this.vendedoresRepository.findOne({ where: { id: vendedorId } });
				if (!vendedor) {
					throw new NotFoundException('Usuario no encontrado');
				}

				if (payload.nombre !== undefined) {
					vendedor.nombre = String(payload.nombre);
				}
				if (payload.ruess !== undefined) {
					vendedor.ruess = payload.ruess ? String(payload.ruess) : null;
				}
				if (payload.descripcionNegocio !== undefined) {
					vendedor.descripcionNegocio = payload.descripcionNegocio ? String(payload.descripcionNegocio) : null;
				}
				if (payload.integrantesEquipo !== undefined) {
					vendedor.integrantesEquipo = Array.isArray(payload.integrantesEquipo)
						? (payload.integrantesEquipo as string[])
						: [];
				}
				if (payload.ubicacion !== undefined) {
					vendedor.ubicacion = payload.ubicacion ? String(payload.ubicacion) : null;
				}
				if (payload.whatsapp !== undefined) {
					vendedor.whatsapp = payload.whatsapp ? String(payload.whatsapp) : null;
				}
				if (payload.telefono !== undefined) {
					vendedor.telefono = payload.telefono ? String(payload.telefono) : null;
				}

				await this.vendedoresRepository.save(vendedor);
				break;
			}
			case 'nuevo_producto': {
				const payload = solicitud.payload as Record<string, unknown>;
				const vendedorId = Number(payload.vendedorId);
				const vendedor = await this.vendedoresRepository.findOne({ where: { id: vendedorId } });
				if (!vendedor) {
					throw new NotFoundException('Vendedor no encontrado');
				}

				await this.productosRepository.save(
					this.productosRepository.create({
						nombre: String(payload.nombre ?? ''),
						descripcion: String(payload.descripcion ?? ''),
						categoria: String(payload.categoria ?? ''),
						subcategoria: payload.subcategoria ? String(payload.subcategoria) : null,
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
				const payload = solicitud.payload as Record<string, unknown>;
				const productoId = Number(payload.productoId);
				const producto = await this.productosRepository.findOne({ where: { id: productoId } });
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
					producto.categoria = String(payload.categoria);
				}
				if (payload.subcategoria !== undefined) {
					producto.subcategoria = payload.subcategoria ? String(payload.subcategoria) : null;
				}
				if (payload.imagenUrl !== undefined) {
					producto.imagenUrl = payload.imagenUrl ? String(payload.imagenUrl) : null;
				}
				if (payload.imagenUrl2 !== undefined) {
					producto.imagenUrl2 = payload.imagenUrl2 ? String(payload.imagenUrl2) : null;
				}
				if (payload.imagenUrl3 !== undefined) {
					producto.imagenUrl3 = payload.imagenUrl3 ? String(payload.imagenUrl3) : null;
				}
				if (payload.imagenUrl4 !== undefined) {
					producto.imagenUrl4 = payload.imagenUrl4 ? String(payload.imagenUrl4) : null;
				}

				await this.productosRepository.save(producto);
				break;
			}
			default:
				throw new BadRequestException('Tipo de solicitud no soportado');
		}
	}
}
