import {Logger} from '@nestjs/common';
import {CommandHandler, ICommandHandler, EventBus} from '@nestjs/cqrs';
import { UserRepository, UserEntity } from '@graphqlcqrs/repository';
import { generateVerificationCode } from '@graphqlcqrs/common/utils/verification-code-generator';
import { AuthenticationError } from 'apollo-server-express';
import { RegisterUserCommand } from '../../impl';
import { UserRegisteredEvent } from '../../../';
import { BooleanPayload } from '@graphqlcqrs/core/dto';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RegisterUserCommand): Promise<BooleanPayload> {
    Logger.log('Async RegisterUserHandler...', 'RegisterUserCommand');
    const { cmd } = command;

    try {

      const userExist: boolean = await this.userRepository.exist({
        'emails.address': cmd.email,
      });

      if (userExist) {
        throw new AuthenticationError('User with this authentication method already exist');
      }

      // @ts-ignore
      const user: UserEntity = {
        firstname: cmd.firstname,
        lastname: cmd.lastname,
        emails: [{
          address: cmd.email,
          primary: true,
          verified: false,
          verificationCode: generateVerificationCode(6, { type: 'number' }),
        }],
        roles: ['member'],
        services: {
          password: {
            hashed: cmd.password,
          },
        },
      };

      const result = await this.userRepository.create(user);
      this.eventBus.publish(new UserRegisteredEvent(result));
      return {
        success: true,
      };
    } catch (error) {
      Logger.log(error, 'RegisterUserHandler');
      throw new AuthenticationError(error.message);
    }
  }

}
