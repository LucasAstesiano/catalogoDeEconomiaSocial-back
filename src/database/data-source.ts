import 'dotenv/config';
import { DataSource } from 'typeorm';
import { validateEnvironment } from '../config/environment';

const environment = validateEnvironment(process.env);

export default new DataSource({
  type: 'postgres',
  host: environment.DB_HOST ?? 'localhost',
  port: Number(environment.DB_PORT ?? 5433),
  username: environment.DB_USER ?? 'postgres',
  password: environment.DB_PASSWORD,
  database: environment.DB_NAME ?? 'db-catalogo',
  entities: [`${__dirname}/../models/**/*.entity{.js,.ts}`],
  migrations: [`${__dirname}/migrations/*{.js,.ts}`],
  synchronize: false,
});
