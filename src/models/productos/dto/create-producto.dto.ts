export class CreateProductoDto {
	nombre: string;
	precio: number;
	descripcion: string;
	categoria: string;
	subcategoria?: string;
	imagenUrl?: string;
	vendedorId: number;
}
