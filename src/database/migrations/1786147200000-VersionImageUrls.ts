import type { MigrationInterface, QueryRunner } from 'typeorm';

export class VersionImageUrls1786147200000 implements MigrationInterface {
  name = 'VersionImageUrls1786147200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'imagen_url',
      'imagen_url_2',
      'imagen_url_3',
      'imagen_url_4',
    ]) {
      await queryRunner.query(`
        UPDATE productos
        SET ${column} = regexp_replace(
          ${column},
          '^(https?://[^/]+)/uploads/image\\?',
          '\\1/api/v1/uploads/image?'
        )
        WHERE ${column} ~ '^https?://[^/]+/uploads/image\\?'
      `);
    }
    await queryRunner.query(`
      UPDATE vendedores
      SET logo_url = regexp_replace(
        logo_url,
        '^(https?://[^/]+)/uploads/image\\?',
        '\\1/api/v1/uploads/image?'
      )
      WHERE logo_url ~ '^https?://[^/]+/uploads/image\\?'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'imagen_url',
      'imagen_url_2',
      'imagen_url_3',
      'imagen_url_4',
    ]) {
      await queryRunner.query(`
        UPDATE productos
        SET ${column} = replace(${column}, '/api/v1/uploads/image?', '/uploads/image?')
        WHERE ${column} LIKE '%/api/v1/uploads/image?%'
      `);
    }
    await queryRunner.query(`
      UPDATE vendedores
      SET logo_url = replace(logo_url, '/api/v1/uploads/image?', '/uploads/image?')
      WHERE logo_url LIKE '%/api/v1/uploads/image?%'
    `);
  }
}
