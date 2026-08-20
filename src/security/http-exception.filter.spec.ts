import { QueryFailedError } from 'typeorm';
import { postgresConflictMessage } from './http-exception.filter';

describe('postgresConflictMessage', () => {
  it.each([
    ['23505', 'Ya existe un registro con esos datos'],
    [
      '23503',
      'El registro esta relacionado con otros datos y no puede eliminarse',
    ],
  ])('mapea el codigo PostgreSQL %s', (code, expected) => {
    const error = new QueryFailedError('consulta', [], { code });
    expect(postgresConflictMessage(error)).toBe(expected);
  });

  it('no transforma otros errores de base de datos', () => {
    const error = new QueryFailedError('consulta', [], { code: '22001' });
    expect(postgresConflictMessage(error)).toBeNull();
  });
});
