import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Vendedor } from '../../vendedores/entities/vendedore.entity';
import { Categoria } from '../../categorias/entities/categoria.entity';
import { Subcategoria } from '../../categorias/entities/subcategoria.entity';

@Entity({ name: 'productos' })
export class Producto {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 120 })
  nombre: string;

  @Column({ type: 'text' })
  descripcion: string;

  @Column({ type: 'varchar', length: 80 })
  categoria: string;

  @Column({ name: 'categoria_id' })
  categoriaId: number;

  @ManyToOne(() => Categoria, (categoria) => categoria.productos, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'categoria_id' })
  categoriaDefinida: Categoria;

  @Column({ type: 'varchar', length: 120, nullable: true })
  subcategoria: string | null;

  @Column({ name: 'subcategoria_id', nullable: true })
  subcategoriaId: number | null;

  @ManyToOne(() => Subcategoria, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'subcategoria_id' })
  subcategoriaDefinida: Subcategoria | null;

  @Column({ name: 'imagen_url', type: 'text', nullable: true })
  imagenUrl: string | null;

  @Column({ name: 'imagen_url_2', type: 'text', nullable: true })
  imagenUrl2: string | null;

  @Column({ name: 'imagen_url_3', type: 'text', nullable: true })
  imagenUrl3: string | null;

  @Column({ name: 'imagen_url_4', type: 'text', nullable: true })
  imagenUrl4: string | null;

  @Column({ name: 'vendedor_id' })
  vendedorId: number;

  @Column({ type: 'boolean', default: false })
  destacado: boolean;

  @ManyToOne(() => Vendedor, (vendedor) => vendedor.productos, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'vendedor_id' })
  vendedor: Vendedor;
}
