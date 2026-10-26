import { Injectable } from '@nestjs/common';
import { config as loadEnv } from 'dotenv';
import { Env, validateEnv } from './env.schema.js';

@Injectable()
export class EnvService {
  private readonly env: Env;

  constructor() {
    loadEnv();
    this.env = validateEnv(process.env);
  }

  get<T extends keyof Env>(key: T): Env[T] {
    return this.env[key];
  }
}
