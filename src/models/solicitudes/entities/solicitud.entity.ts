import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type SolicitudTipo =
  | 'registro_usuario'
  | 'actualizacion_datos'
  | 'nuevo_producto'
  | 'actualizacion_producto';

export type SolicitudEstado = 'pendiente' | 'aprobada' | 'rechazada';

@Entity({ name: 'solicitudes' })
export class Solicitud {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'varchar', length: 40 })
	tipo: SolicitudTipo;

	@Column({ type: 'varchar', length: 20, default: 'pendiente' })
	estado: SolicitudEstado;

	@Column({ name: 'solicitante_id', type: 'integer', nullable: true })
	solicitanteId: number | null;

	@Column({ name: 'solicitante_email', type: 'varchar', length: 160, nullable: true })
	solicitanteEmail: string | null;

	@Column({ name: 'solicitante_nombre', type: 'varchar', length: 120, nullable: true })
	solicitanteNombre: string | null;

	@Column({ name: 'entidad_objetivo', type: 'varchar', length: 40, nullable: true })
	entidadObjetivo: 'vendedor' | 'producto' | 'nuevo_vendedor' | null;

	@Column({ name: 'entidad_id', type: 'integer', nullable: true })
	entidadId: number | null;

	@Column({ type: 'jsonb' })
	payload: Record<string, unknown>;

	@Column({ name: 'resuelto_por', type: 'integer', nullable: true })
	resueltoPor: number | null;

	@CreateDateColumn({ name: 'created_at' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt: Date;

	@Column({ name: 'resolved_at', type: 'timestamp', nullable: true })
	resolvedAt: Date | null;
}