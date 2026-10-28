export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = ApplicationError.name;
  }

  static prismaErrorToHttpStatus(code: string): number {
    switch (code) {
      case 'P2000':
      case 'P2003':
        return 400;
      case 'P2001':
      case 'P2025':
        return 404;
      case 'P2002':
      case 'P2004':
        return 409;
      case 'P2005':
      case 'P2006':
        return 422;
      default:
        return 500;
    }
  }
}
