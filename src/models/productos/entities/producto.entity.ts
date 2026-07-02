import {
	Column,
	Entity,
	JoinColumn,
	ManyToOne,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { Vendedor} from '../../vendedores/entities/vendedore.entity';

@Entity({ name: 'productos' })
export class Producto {
	@PrimaryGeneratedColumn()
	id: number;

	@Column({ type: 'varchar', length: 120 })
	nombre: string;

	@Column({ type: 'decimal', precision: 10, scale: 2 })
	precio: number;

	@Column({ type: 'text' })
	descripcion: string;

	@Column({ type: 'varchar', length: 80 })
	categoria: string;

	@Column({ type: 'varchar', length: 120, nullable: true })
	subcategoria: string | null;

	@Column({ name: 'imagen_url', type: 'text', nullable: true })
	imagenUrl: string | null;

	@Column({ name: 'vendedor_id' })
	vendedorId: number;

	@ManyToOne(() => Vendedor, (vendedor) => vendedor.productos, {
		nullable: false,
		onDelete: 'RESTRICT',
	})
	@JoinColumn({ name: 'vendedor_id' })
	vendedor: Vendedor;
}

