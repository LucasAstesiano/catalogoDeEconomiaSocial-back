export class CreateVendedoreDto {
	nombre: string;
	email: string;
	password: string;
	rol?: 'usuario' | 'administrador';
	ruess?: string;
	descripcionNegocio?: string;
	integrantesEquipo?: string[];
	ubicacion?: string;
	whatsapp?: string;
	telefono?: string;
}
