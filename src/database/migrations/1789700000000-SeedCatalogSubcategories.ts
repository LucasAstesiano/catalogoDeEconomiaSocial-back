import type { MigrationInterface, QueryRunner } from 'typeorm';

const CATEGORY_RENAMES: ReadonlyArray<readonly [string, string]> = [
  ['ALIMENTOS Y BEBIDAS', 'Alimentos y Bebidas'],
  ['Artesanía Folklórica', 'Artesanías Folcloricas'],
  ['DECO, HOGAR y JARDÍN', 'Decoracion, Hogar y Jardin'],
  ['INDUMENTARIA / VESTIMENTA', 'Indumentaria'],
  ['INSTRUMENTOS MUSICALES', 'Instrumentos Musicales'],
  ['JUEGOS Y JUGUETES', 'Juegos y juguetes'],
  ['LIBRERÍA', 'Libreria y Papeleria'],
  ['MASCOTAS', 'Mascotas'],
  ['PERFUMERÍA Y LIMPIEZA', 'Perfumeria, Cosmetica,Limpieza'],
  ['SERVICIOS', 'Servicios'],
];

const SUBCATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ['Artesanías Folcloricas', 'Cuero'],
  ['Artesanías Folcloricas', 'Lana'],
  ['Artesanías Folcloricas', 'Telar'],
  ['Artesanías Folcloricas', 'Junquillo'],
  ['Mascotas', 'Alimentacion'],
  ['Mascotas', 'Higiene y Cuidado'],
  ['Mascotas', 'Juguetes y Entretenimiento'],
  ['Mascotas', 'Indumentaria y accesorios'],
  ['Mascotas', 'Camas y Refugios'],
  ['Mascotas', 'Salud y Bienestar'],
  ['Mascotas', 'Transportacion'],
  ['Mascotas', 'Entretenimiento'],
  ['Mascotas', 'Acuarios y Terrarios'],
  ['Mascotas', 'Servicio'],
  ['Perfumeria, Cosmetica,Limpieza', 'Cosmeticas'],
  ['Perfumeria, Cosmetica,Limpieza', 'Perfumería'],
  ['Perfumeria, Cosmetica,Limpieza', 'Higiene Personal'],
  ['Perfumeria, Cosmetica,Limpieza', 'Productos de Limpieza para el Hogar'],
  [
    'Perfumeria, Cosmetica,Limpieza',
    'Productos de Limpieza para el Lavado de Ropa',
  ],
  ['Perfumeria, Cosmetica,Limpieza', 'Porductos de limpieza para automoviles'],
  ['Perfumeria, Cosmetica,Limpieza', 'Utensilios de Limpieza'],
  ['Libreria y Papeleria', 'Escritorio'],
  ['Libreria y Papeleria', 'Accesorios de PC / Notebook /Celulares'],
  ['Libreria y Papeleria', 'Papeleria'],
  ['Decoracion, Hogar y Jardin', 'Artículos de cocina y comedor'],
  ['Decoracion, Hogar y Jardin', 'Artículos de organización:'],
  ['Decoracion, Hogar y Jardin', 'Decoración y accesorios:'],
  ['Decoracion, Hogar y Jardin', 'Artículos textiles'],
  ['Indumentaria', 'Bebes y Niños'],
  ['Indumentaria', 'Urbana'],
  ['Indumentaria', 'Deportivo'],
  ['Indumentaria', 'Alta Costura y Sastreria'],
  ['Indumentaria', 'Uniformes y Ropa de Trabajo'],
  ['Indumentaria', 'Vestimenta Gaucha'],
  ['Indumentaria', 'Ropa Interior'],
  ['Indumentaria', 'Accesorios y Complementos'],
  ['Indumentaria', 'Marroquineria'],
  ['Indumentaria', 'Calzado'],
  ['Indumentaria', 'Moda Sustentable'],
  ['Juegos y juguetes', 'Muñecos'],
  ['Juegos y juguetes', 'Juegos para Mesa y Jardín'],
  ['Juegos y juguetes', 'Juegos para Apilar y Encastrar'],
  ['Juegos y juguetes', 'Títeres'],
  ['Juegos y juguetes', 'Juguetes con Ruedas'],
  ['Juegos y juguetes', 'Juegos para Enseñar'],
  ['Juegos y juguetes', 'Juegos Sensoriales'],
  ['Juegos y juguetes', 'Disfraces'],
  ['Juegos y juguetes', 'tejidos'],
  ['Juegos y juguetes', 'didácticos'],
  ['Juegos y juguetes', 'Impresos en 3D'],
  ['Servicios', 'Ambientales'],
  ['Servicios', 'Enseñanza'],
  ['Servicios', 'Belleza'],
  ['Servicios', 'Impresión 3D'],
  ['Servicios', 'Gráficos'],
  ['Servicios', 'Mantenimiento del Hogar'],
  ['Servicios', 'Para Eventos'],
  ['Servicios', 'Textiles'],
  ['Servicios', 'Sonido'],
  ['Servicios', 'Lavado de Vehículos'],
  ['Servicios', 'Sublimación en tela'],
  ['Servicios', 'Cuidado de Personas'],
  ['Servicios', 'Profesionales (No incluye Salud)'],
  ['Instrumentos Musicales', 'Cordofonos'],
  ['Instrumentos Musicales', 'Percusion'],
  ['Instrumentos Musicales', 'Aerofonos'],
  ['Alimentos y Bebidas', 'Alimentos Cárnicos'],
  ['Alimentos y Bebidas', 'Aceites alimenticios - Grasas'],
  ['Alimentos y Bebidas', 'Lácteos'],
  ['Alimentos y Bebidas', 'Farináceos, Cereales, Harinas y Derivados'],
  ['Alimentos y Bebidas', 'Pastas'],
  ['Alimentos y Bebidas', 'Masas Frescas'],
  ['Alimentos y Bebidas', 'Productos Copetín'],
  ['Alimentos y Bebidas', 'Pastelería'],
  ['Alimentos y Bebidas', 'Barras de cereales'],
  ['Alimentos y Bebidas', 'Cereales en bolsita'],
  ['Alimentos y Bebidas', 'Azucarados'],
  ['Alimentos y Bebidas', 'Confitería'],
  ['Alimentos y Bebidas', 'Confituras'],
  ['Alimentos y Bebidas', 'Néctares'],
  ['Alimentos y Bebidas', 'Licuados y Jugos'],
  ['Alimentos y Bebidas', 'Alimentos vegetales'],
  ['Alimentos y Bebidas', 'Bebidas'],
  ['Alimentos y Bebidas', 'Productos Estimulantes o Fruitivos'],
  ['Alimentos y Bebidas', 'Correctivos y Coadyuvantes'],
  ['Alimentos y Bebidas', 'Alimentos de Régimen o Dietéticos'],
  ['Alimentos y Bebidas', 'Comidas/ Rotisería'],
];

export class SeedCatalogSubcategories1789700000000 implements MigrationInterface {
  name = 'SeedCatalogSubcategories1789700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE subcategorias (
        id SERIAL PRIMARY KEY,
        categoria_id integer NOT NULL REFERENCES categorias(id) ON DELETE RESTRICT,
        nombre varchar(120) NOT NULL,
        CONSTRAINT subcategorias_categoria_nombre_uq UNIQUE (categoria_id, nombre)
      )
    `);
    await queryRunner.query(
      'ALTER TABLE productos ADD COLUMN subcategoria_id integer REFERENCES subcategorias(id) ON DELETE RESTRICT',
    );

    for (const [previousName, name] of CATEGORY_RENAMES) {
      const result: unknown = await queryRunner.query(
        'SELECT id FROM categorias WHERE nombre = $1',
        [previousName],
      );
      const categoria = Array.isArray(result)
        ? (result[0] as { id: number } | undefined)
        : undefined;
      if (!categoria) continue;
      await queryRunner.query(
        'UPDATE categorias SET nombre = $1 WHERE id = $2',
        [name, categoria.id],
      );
      await queryRunner.query(
        'UPDATE productos SET categoria = $1 WHERE categoria_id = $2',
        [name, categoria.id],
      );
    }

    for (const [categoryName, subcategoryName] of SUBCATEGORIES) {
      await queryRunner.query(
        `INSERT INTO subcategorias (categoria_id, nombre)
         SELECT id, $2 FROM categorias WHERE nombre = $1
         ON CONFLICT (categoria_id, nombre) DO NOTHING`,
        [categoryName, subcategoryName],
      );
    }

    await queryRunner.query(`
      UPDATE productos AS producto
      SET subcategoria_id = subcategoria.id
      FROM subcategorias AS subcategoria
      WHERE subcategoria.categoria_id = producto.categoria_id
        AND subcategoria.nombre = producto.subcategoria
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE productos DROP COLUMN subcategoria_id',
    );
    await queryRunner.query('DROP TABLE subcategorias');
  }
}
