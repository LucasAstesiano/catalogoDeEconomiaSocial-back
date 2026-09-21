import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Producto } from '../../productos/entities/producto.entity';

@Entity({ name: 'categorias' })
export class Categoria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 80, unique: true })
  nombre: string;

  @Column({ name: 'icono_url', type: 'varchar', length: 2048, nullable: true })
  iconoUrl: string | null;

  @Column({ type: 'boolean', default: true })
  activa: boolean;

  @OneToMany(() => Producto, (producto) => producto.categoriaDefinida)
  productos: Producto[];
}
