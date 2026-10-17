import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Turns database-level guarantees into messages an operator can act on. The
 * partial unique indexes behind BR-02 and BR-09 surface here when a service
 * check is bypassed or two requests race.
 */
@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();
    const { status, message } = this.describe(exception);
    this.logger.warn(`${exception.code ?? 'DB'}: ${exception.message.split('\n').pop()}`);
    response.status(status).send({ statusCode: status, message });
  }

  private describe(exception: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
  } {
    const target = String((exception.meta as any)?.target ?? '');

    if (exception.code === 'P2002') {
      if (target.includes('one_active_assignment_per_vehicle')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'This vehicle already has an active assignment. Return it first.',
        };
      }
      if (target.includes('one_current_holder_per_fuel_card')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'This fuel card is already held by someone. Release it first.',
        };
      }
      if (target.includes('one_inspection_per_assignment_type')) {
        return {
          status: HttpStatus.CONFLICT,
          message: 'This assignment already has an inspection of that type.',
        };
      }
      return {
        status: HttpStatus.CONFLICT,
        message: `That ${target.replace(/[_,]/g, ' ').trim() || 'value'} is already in use.`,
      };
    }

    if (exception.code === 'P2025') {
      return { status: HttpStatus.NOT_FOUND, message: 'That record no longer exists.' };
    }

    if (exception.code === 'P2003') {
      return {
        status: HttpStatus.CONFLICT,
        message: 'This record is referenced by other records and cannot be removed.',
      };
    }

    // Append-only triggers raise a plain SQL exception rather than a Prisma code.
    if (/append-only|cannot be changed/.test(exception.message)) {
      return {
        status: HttpStatus.FORBIDDEN,
        message: 'This record is part of the permanent history and cannot be changed.',
      };
    }

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'The database rejected that change.' };
  }
}
