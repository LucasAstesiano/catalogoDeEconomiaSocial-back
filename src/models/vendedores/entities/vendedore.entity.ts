import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Producto } from '../../productos/entities/producto.entity';

@Entity({ name: 'vendedores' })
export class Vendedor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20, default: 'usuario' })
  rol: 'usuario' | 'administrador';

  @Column({
    name: 'estado_solicitud',
    type: 'varchar',
    length: 20,
    default: 'aprobado',
  })
  estadoSolicitud: 'pendiente' | 'aprobado' | 'rechazado';

  @Column({ length: 120 })
  nombre: string;

  @Column({ unique: true, length: 160 })
  email: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  ruess: string | null;

  @Column({ name: 'es_monotributista', type: 'boolean', nullable: true })
  esMonotributista: boolean | null;

  @Column({ name: 'descripcion_negocio', type: 'text', nullable: true })
  descripcionNegocio: string | null;

  @Column({
    name: 'integrantes_equipo',
    type: 'text',
    array: true,
    default: '{}',
  })
  integrantesEquipo: string[];

  @Column({ type: 'text', nullable: true })
  ubicacion: string | null;

  @Column({ type: 'text', nullable: true })
  whatsapp: string | null;

  @Column({ type: 'text', nullable: true })
  telefono: string | null;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string | null;

  @Column({ name: 'redes_sociales', type: 'jsonb', default: () => "'[]'" })
  redesSociales: Array<{
    tipo: 'facebook' | 'instagram';
    url: string;
  }>;

  @Column({ name: 'password_hash', length: 128 })
  passwordHash: string;

  @Column({ name: 'session_version', type: 'integer', default: 0 })
  sessionVersion: number;

  @Column({ name: 'password_change_required', type: 'boolean', default: false })
  passwordChangeRequired: boolean;

  @Column({
    name: 'temporary_password_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  temporaryPasswordExpiresAt: Date | null;

  @Column({ name: 'admin_mfa_challenge_id', type: 'uuid', nullable: true })
  adminMfaChallengeId: string | null;

  @Column({
    name: 'admin_mfa_code_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  adminMfaCodeHash: string | null;

  @Column({ name: 'admin_mfa_expires_at', type: 'timestamptz', nullable: true })
  adminMfaExpiresAt: Date | null;

  @Column({ name: 'admin_mfa_attempts', type: 'smallint', default: 0 })
  adminMfaAttempts: number;

  @OneToMany(() => Producto, (producto) => producto.vendedor)
  productos: Producto[];
}
