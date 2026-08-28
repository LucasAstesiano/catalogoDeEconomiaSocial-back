import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('endurecimiento reproducible de contenedores', () => {
  const projectRoot = resolve(__dirname, '../../../..');
  const backendDockerfile = readFileSync(
    resolve(projectRoot, 'back-catalogo/catalogo-back/Dockerfile'),
    'utf8',
  );
  const frontendDockerfile = readFileSync(
    resolve(projectRoot, 'gobierno/Dockerfile'),
    'utf8',
  );
  const compose = readFileSync(
    resolve(projectRoot, 'compose.production.yml'),
    'utf8',
  );

  it('fija por digest todas las bases Node', () => {
    for (const dockerfile of [backendDockerfile, frontendDockerfile]) {
      const nodeStages = dockerfile.match(/^FROM node:[^\n]+$/gm) ?? [];
      expect(nodeStages.length).toBeGreaterThanOrEqual(2);
      expect(nodeStages.every((line) => line.includes('@sha256:'))).toBe(true);
    }
  });

  it('no conserva compiladores en el runtime del backend', () => {
    const runtimeStage = backendDockerfile.split(/ AS runner\s*/)[1];
    expect(runtimeStage).toBeDefined();
    expect(runtimeStage).not.toMatch(/\b(?:python3|make|g\+\+)\b/);
  });

  it('ejecuta Nginx no-root, de solo lectura y sin capacidades', () => {
    const nginxService = compose
      .split(/\n\s{2}nginx:\n/)[1]
      ?.split(/\nvolumes:\n/)[0];
    expect(nginxService).toContain('user: "101:101"');
    expect(nginxService).toContain('read_only: true');
    expect(nginxService).toMatch(/cap_drop:\s+- ALL/);
    expect(nginxService).toContain('no-new-privileges:true');
  });
});
