import {
  CredentialApplication,
  CredentialManifest,
  decodeVerifiablePresentation,
  InputDescriptor,
  PresentationDefinition,
  VerificationSubmission
} from "@centre/verity"
import Ajv from "ajv"
import { VerifiableCredential, VerifiablePresentation } from "did-jwt-vc"
import jsonpath from "jsonpath"
import { vcSchema, vpSchema } from "./schemas"
import {
  ProcessedCredentialApplication,
  ProcessedVerificationSubmission,
  ConstraintCheck,
  PathMatches as PathMatch,
  ValidationCheck,
  ValidationFailure
} from "types"

const ajv = new Ajv()

export function errorToValidationFailure(err: Error): ValidationFailure {
  return {
    status: 400,
    title: err.name,
    detail: err.message
  }
}

export function messageToVerificationFailure(
  message: string
): ValidationFailure {
  return {
    status: 400,
    title: "Validation Failure",
    detail: message
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ajvErrorToVerificationFailures(errors: any): ValidationFailure[] {
  const convertedErrors = errors.map((e) => {
    return {
      status: 400, // TODO
      title: `${e.keyword} json schema validation failure`,
      detail: `${e.dataPath ? e.dataPath : "input"} ${e.message}`,
      source: {
        path: e.dataPath
      },
      original: e
    }
  })
  return convertedErrors
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function validateSchema(input: any, schema: any, errors: ValidationFailure[]): boolean {
  const validate = ajv.compile(schema)
  const valid = validate(input)
  if (!valid) {
    errors.push(...ajvErrorToVerificationFailures(validate.errors))
  }
  return valid as boolean
}

export function validateVc(vc: VerifiableCredential, errors: ValidationFailure[]): boolean {
  return validateSchema(vc, vcSchema, errors)
}

export function validateVp(vp: VerifiablePresentation, errors: ValidationFailure[]): boolean {
  return validateSchema(vp, vpSchema, errors)
}

export function validateInputDescriptors(
  creds: Map<string, VerifiableCredential[]>, 
  descriptors: InputDescriptor[]): Map<string, ValidationCheck[]> {
  return descriptors.reduce((map, descriptor) => {
    map[descriptor.id] = descriptor.schema.reduce((matches, obj) => {
      const candidates = creds[obj.uri];
      matches = !candidates ? matches : matches.concat(candidates.map(cred => {
        const constraints = descriptor.constraints;
        if (!constraints || !constraints.fields) {
          return new ValidationCheck(descriptor.id, cred, [])
        }
        const xform = constraints.fields.map((field, fieldIndex) => {
          const pathMatchResults = field.path.reduce((pathMatches: PathMatch[], path) => {
            try {
              const values = jsonpath.query(cred, path);
              if (values.length === 0) return pathMatches;
              if (!field.filter || ajv.validate(field.filter, values[0])) {
                pathMatches.push(new PathMatch(path, !field.filter ? "*" : values[0]))
              } 
              return pathMatches
            }
            catch (e) {
              console.error(e)
              return pathMatches;
            }
          }, new Array<PathMatch>());
          return new ConstraintCheck(fieldIndex, pathMatchResults) 
        });
        return new ValidationCheck(descriptor.id, cred, xform)
      }));
      return matches;
    }, []);
    return map;
  }, new Map<string, ValidationCheck[]>())
}

function mapInputsToDescriptors(
  submission: VerificationSubmission,
  definition: PresentationDefinition
) {
  return submission.presentation_submission.descriptor_map.reduce((map, d) => {
    const match = definition.input_descriptors.find((id) => id.id === d.id)
    const values = jsonpath.query(submission, d.path)
    map[match.schema[0].uri] = values
    return map
  }, new Map<string, VerifiableCredential[]>())
}

export async function processVerificationSubmission(
  submission: VerificationSubmission,
  definition: PresentationDefinition
): Promise<ProcessedVerificationSubmission> {

  const decoded = await decodeVerifiablePresentation(submission.presentation)
  const converted = {
    presentation_submission: submission.presentation_submission,
    presentation: decoded.verifiablePresentation
  }

  const mapped = mapInputsToDescriptors(converted, definition)

  // check conforms to expected schema: disabled for now
  /*
    Object.keys(mapped).map((key) => {
      const schema = findSchemaById(key)
      // TODO(kim)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const result = mapped[key].every((cred) => {
        validateSchema(cred.credentialSubject, schema, errors)
      })
    })
  */

  const checks = validateInputDescriptors(
    mapped,
    definition.input_descriptors
  )

  return new ProcessedVerificationSubmission(
    converted.presentation,
    checks,
    converted.presentation_submission
  )

}

export async function processCredentialApplication(
  application: CredentialApplication,
  manifest: CredentialManifest
): Promise<ProcessedCredentialApplication> {
  const decoded = await decodeVerifiablePresentation(application.presentation)
  const converted = {
    ...application,
    presentation: decoded.verifiablePresentation
  }

  const mapped = mapInputsToDescriptors(
    converted,
    manifest.presentation_definition
  )

  const checks: Map<string, ValidationCheck[]> = validateInputDescriptors(
    mapped,
    manifest.presentation_definition.input_descriptors
  )
  return new ProcessedCredentialApplication(
    converted.credential_application,
    converted.presentation,
    checks,
    converted.presentation_submission)
}