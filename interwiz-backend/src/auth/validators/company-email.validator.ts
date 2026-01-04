import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

// List of common personal email domains to reject
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'aol.com',
  'live.com',
  'msn.com',
  'yandex.com',
  'zoho.com',
  'gmx.com',
  'mail.ru',
  'qq.com',
];

@ValidatorConstraint({ async: false })
export class IsCompanyEmailConstraint implements ValidatorConstraintInterface {
  validate(email: string, args: ValidationArguments) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) {
      return false;
    }

    // Reject if it's a personal email domain
    return !PERSONAL_EMAIL_DOMAINS.includes(domain);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Company email addresses only. Personal emails like @gmail.com are not allowed.';
  }
}

export function IsCompanyEmail(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsCompanyEmailConstraint,
    });
  };
}

