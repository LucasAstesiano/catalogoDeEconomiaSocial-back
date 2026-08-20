import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('configuracion segura del rate limit de Nginx', () => {
  const config = readFileSync(
    resolve(__dirname, '../../../../deploy/nginx/default.conf.template'),
    'utf8',
  );

  it('no usa headers controlables por el cliente como clave', () => {
    expect(config).not.toContain('$http_x_forwarded_for');
    expect(config).not.toContain('$proxy_add_x_forwarded_for');
    expect(
      config.match(/limit_req_zone \$binary_remote_addr zone=/g),
    ).toHaveLength(4);
  });

  it('sobrescribe X-Forwarded-For antes de enviarlo a servicios internos', () => {
    const proxyLocations = config.match(/proxy_pass /g) ?? [];
    const safeForwardedHeaders =
      config.match(/proxy_set_header X-Forwarded-For \$remote_addr;/g) ?? [];

    expect(safeForwardedHeaders).toHaveLength(proxyLocations.length);
  });
});
