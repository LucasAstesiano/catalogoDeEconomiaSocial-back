export type RegistrationPayload = {
  nombre: string;
  email: string;
  passwordHash: string;
  ruess?: string | null;
  descripcionNegocio?: string | null;
  integrantesEquipo?: string[];
  ubicacion?: string | null;
  whatsapp?: string | null;
  telefono?: string | null;
};

export type VendorUpdatePayload = {
  vendedorId: number;
  nombre?: string;
  ruess?: string | null;
  descripcionNegocio?: string | null;
  integrantesEquipo?: string[];
  ubicacion?: string | null;
  whatsapp?: string | null;
  telefono?: string | null;
};

export type NewProductPayload = {
  vendedorId: number;
  nombre: string;
  descripcion: string;
  categoria: string;
  subcategoria?: string | null;
  imagenUrl?: string | null;
  imagenUrl2?: string | null;
  imagenUrl3?: string | null;
  imagenUrl4?: string | null;
};

export type ProductUpdatePayload = Omit<
  Partial<NewProductPayload>,
  'vendedorId'
> & { productoId: number };

export type SolicitudPayload =
  | RegistrationPayload
  | VendorUpdatePayload
  | NewProductPayload
  | ProductUpdatePayload;
