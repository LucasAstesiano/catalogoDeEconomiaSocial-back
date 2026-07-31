export class CreateProductoDto {
	nombre: string;
	descripcion: string;
	categoria: string;
	subcategoria?: string;
	imagenUrl?: string;
	imagenUrl2?: string;
	imagenUrl3?: string;
	imagenUrl4?: string;
	vendedorId: number;
	destacado?: boolean;
}
