# Create a note

Creates a new note in Productboard

Whenever the email field is mentioned in the descriptions of this endpoint, it is referring to the field `user.email` or `customer_email`


# OpenAPI definition

```json
{
  "openapi": "3.0.1",
  "info": {
    "title": "Productboard API Reference",
    "contact": {
      "name": "Learn Public API Beta Slack Channel"
    },
    "description": "The Productboard REST API supports pushing feedback to [Productboard](https://www.productboard.com/) and accessing your feature data.\n",
    "version": "1",
    "x-logo": {
      "url": "https://cdn.productboard.com/nucleus/logos/productboard-logo-full.svg",
      "backgroundColor": "#F7F9FA",
      "altText": "Productboard logo"
    }
  },
  "servers": [
    {
      "description": "Productboard API Reference",
      "url": "https://api.productboard.com"
    }
  ],
  "x-tagGroups": [
    {
      "name": "Notes",
      "tags": [
        "Notes"
      ]
    },
    {
      "name": "Companies & Users",
      "tags": [
        "Companies & Users"
      ]
    },
    {
      "name": "Product Hierarchy",
      "tags": [
        "Product Hierarchy"
      ]
    },
    {
      "name": "Custom Fields",
      "tags": [
        "Custom Fields"
      ]
    },
    {
      "name": "Releases & Release Groups",
      "tags": [
        "Releases & Release Groups"
      ]
    },
    {
      "name": "Objectives",
      "tags": [
        "Objectives"
      ]
    },
    {
      "name": "Key Results",
      "tags": [
        "Key Results"
      ]
    },
    {
      "name": "Initiatives",
      "tags": [
        "Initiatives"
      ]
    },
    {
      "name": "Webhooks",
      "tags": [
        "Webhooks"
      ]
    },
    {
      "name": "Plugin Integrations",
      "tags": [
        "Plugin Integrations"
      ]
    },
    {
      "name": "JIRA Integrations",
      "tags": [
        "JIRA Integrations"
      ]
    }
  ],
  "paths": {
    "/notes": {
      "post": {
        "summary": "Create a note",
        "description": "Creates a new note in Productboard\n\nWhenever the email field is mentioned in the descriptions of this endpoint, it is referring to the field `user.email` or `customer_email`\n",
        "operationId": "create_note",
        "tags": [
          "Notes"
        ],
        "responses": {
          "201": {
            "description": "Note created",
            "content": {
              "application/json; charset=utf-8": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "links": {
                      "type": "object",
                      "properties": {
                        "html": {
                          "allOf": [
                            {
                              "$ref": "#/components/schemas/URL"
                            }
                          ],
                          "example": "https://space.productboard.com/inbox/notes/123456",
                          "description": "Note is accessible via this URL in the Productboard application"
                        }
                      }
                    },
                    "data": {
                      "type": "object",
                      "properties": {
                        "id": {
                          "$ref": "#/components/schemas/UUID"
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          "409": {
            "$ref": "#/components/responses/Conflict"
          },
          "422": {
            "$ref": "#/components/responses/UnprocessableCreate"
          },
          "429": {
            "$ref": "#/components/responses/RateLimited"
          }
        },
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/NoteCreateRequest"
              }
            }
          },
          "description": "Note to add"
        },
        "parameters": [
          {
            "$ref": "#/components/parameters/Version"
          },
          {
            "in": "header",
            "name": "Productboard-Partner-Id",
            "description": "A unique string identifying the external system through which the data came.",
            "schema": {
              "type": "string"
            },
            "required": false
          }
        ]
      }
    }
  },
  "components": {
    "securitySchemes": {
      "JWT-Token": {
        "description": "Following is the technical OpenAPI 3.0 specification of the JWT token method used to authenticate requests to the API:\n",
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    },
    "parameters": {
      "Version": {
        "name": "X-Version",
        "description": "API version.",
        "in": "header",
        "required": true,
        "schema": {
          "type": "integer",
          "enum": [
            1
          ]
        },
        "example": 1
      }
    },
    "schemas": {
      "UUID": {
        "type": "string",
        "format": "uuid",
        "description": "Entity identifier.",
        "example": "00000000-0000-0000-0000-000000000000"
      },
      "Source": {
        "description": "For entities that originated in external systems and entered Productboard via the API or integrations, the source keeps track of the original source entity in that origin system(s). Once this is set, it cannot be updated by design. It’s a reference to an external system, and if that reference changes to another external resource, we consider it as different Note. The recommended way is to create a new note that will refer to different origins.",
        "type": "object",
        "required": [
          "origin",
          "record_id"
        ],
        "properties": {
          "origin": {
            "type": "string",
            "description": "A unique string identifying the external system from which the data came",
            "example": "deskdesk"
          },
          "record_id": {
            "type": "string",
            "description": "The unique id of the record in the origin system",
            "example": "123"
          }
        }
      },
      "ApiErrors": {
        "type": "object",
        "properties": {
          "ok": {
            "type": "boolean",
            "example": false
          },
          "errors": {
            "type": "object",
            "properties": {
              "source": {
                "type": "array",
                "items": {
                  "type": "string",
                  "example": "Error message here"
                }
              }
            }
          }
        },
        "required": [
          "ok"
        ]
      },
      "notes.model_DisplayUrl": {
        "type": "string",
        "format": "url",
        "pattern": "^(?:http(s)?:\\/\\/)?[\\w.-]+(?:\\.[\\w\\.-]+)+[\\w\\-\\._~:/?#[\\]@!\\$&'\\(\\)\\*\\+,;=.]+$",
        "example": "https://www.example.com/deskdesk/notes/123",
        "description": "For entities that originated in external systems and entered Productboard via the API or integrations, a url where the external entity can be accessed - displayed as a clickable title in the Productboard UI."
      },
      "notes.model_User": {
        "type": "object",
        "minProperties": 1,
        "properties": {
          "email": {
            "type": "string",
            "format": "email",
            "description": "Email address of a user to be attached to the note. Productboard tries to resolve this email (and possibly external ID, see below) to an existing user entity, creating one if no such user exists.\nAlso, the domain part of given email address is used to resolve a Company to link the note (and possibly the newly created user) to.\n\nThis field can't be combined with neither `customer_email` nor `company.domain`.\n",
            "example": "phillip.j.fry@planetexpress.com",
            "maxLength": 256
          },
          "external_id": {
            "type": "string",
            "description": "This attribute represents a distinct identification associated with a user, assigned through Productboard.\n\nIt enables the unique differentiation and recognition of each user within the system.\n\nThe following scenarios might trigger conflicts:\n+ If the provided external ID does not correspond with the current external ID of the user determined by the specified email address.\n+ If the given email address does not align with the existing email address of the user associated with the specified external ID.\n",
            "example": "cf5e7b20-d12a-4c6a-8ce2-128070de5dfc",
            "maxLength": 256
          }
        }
      },
      "notes.model_Company": {
        "type": "object",
        "description": "The company to be associated with the note.",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid",
            "description": "The id of the company.\n\nThis attribute cannot be combined with the `domain` attribute.\n"
          },
          "domain": {
            "type": "string",
            "format": "domain",
            "description": "Domain of a company the note (and possibly a user) should be linked to.\n\nThis attribute cannot be combined with the `id` attribute.\n\nThis attribute is currently meant exclusively to substitute the default Company domain extraction mechanism (based on the domain part of an email address) when identifying a user via `user.external_id` only.\nTherefore, it can't be combined with any email field - in that case the Company domain is extracted automatically from given email address.\n\nThe Company resolution mechanism based on `company.domain` works as follows:\n\n- If only `company.domain` is provided that doesn't match any existing Company within Productboard, a new Company is created and the note is linked to that Company.\n- If only `company.domain` is provided that matches an existing Company within Productboard, the note is linked to that Company.\n- If both `user.external_id` and `company.domain` are provided and the user identified by given external ID is already linked to a Company, then given `company.domain` must match the domain of that Company.\n- If both `user.external_id` and `company.domain` are provided and the user identified by given external ID is not linked to a Company and given Company domain matches existing Company in Productboard, then the user is linked to the Company.\n",
            "example": "acme.com",
            "maxLength": 256
          },
          "external_id": {
            "type": "string",
            "description": "This attribute signifies a source record ID for a Company object in PB.\n\nThe ID is imported from external tools such as Salesforce, and uniquely identifies the company within the system.\n\nWhen present, the system first attempts to match a company based on this external_id.\nIf no match is found, the system continues to search by domain.\n\nThis external_id is saved within the Company entity upon its creation or update, provided the existing Company record associated with the given domain does not already contain an external_id.\n",
            "example": "X87juix12W",
            "maxLength": 256
          }
        }
      },
      "NoteCreateRequest": {
        "type": "object",
        "required": [
          "id",
          "title",
          "content"
        ],
        "properties": {
          "title": {
            "type": "string",
            "example": "Note title"
          },
          "content": {
            "description": "HTML-encoded rich text supported by certain tags; unsupported tags will be stripped out",
            "type": "string",
            "example": "Here is some <b>exciting</b> content"
          },
          "customer_email": {
            "type": "string",
            "example": "deprecated@example.com",
            "deprecated": true,
            "description": "Use the `user.email` property instead.\n\nEmail address of customer to attach to the note - will use an existing customer record if one is found, otherwise will create one with the specified email address within a company with matching domain (if it already exists).\n\nThis field can't be combined with neither `company.domain` nor `user.email`.\n"
          },
          "display_url": {
            "$ref": "#/components/schemas/notes.model_DisplayUrl"
          },
          "user": {
            "type": "object",
            "$ref": "#/components/schemas/notes.model_User"
          },
          "company": {
            "type": "object",
            "$ref": "#/components/schemas/notes.model_Company"
          },
          "source": {
            "$ref": "#/components/schemas/Source"
          },
          "owner": {
            "type": "object",
            "description": "The user to add as an owner to the note.\n\nProductboard will try to find an existing user with the given email address and add them as an owner to the note. If no user is found, an error will be thrown.\n",
            "required": [
              "email"
            ],
            "properties": {
              "email": {
                "type": "string",
                "description": "The email of the user to add as an owner",
                "example": "owner@example.com"
              }
            }
          },
          "tags": {
            "type": "array",
            "items": {
              "type": "string"
            },
            "description": "A set of tags for categorizing the note; tag uniqueness is case- and diacritic-insensitive, so Apple, APPLE, and äpple will all end up assigned to the same tag, and the tag displayed will be whichever variant was first (chronologically) entered into Productboard",
            "example": [
              "3.0",
              "important",
              "experimental"
            ]
          }
        }
      },
      "URL": {
        "type": "string",
        "pattern": "^(?:http(s)?:\\/\\/)?[\\w.-]+(?:\\.[\\w\\.-]+)+[\\w\\-\\._~:/?#[\\]@!\\$&'\\(\\)\\*\\+,;=.]+$"
      }
    },
    "responses": {
      "Conflict": {
        "description": "One of the following:\n+ provided email address does not match an existing email address associated with the user identified by the given external ID\n+ provided external ID does not match the existing external ID of the user identified by the given email address\n+ the domain specified in `company.domain` does not correspond with the user's assigned company domain based on the external ID provided\n+ `company.domain` doesn't match the external ID of the company\n",
        "content": {
          "application/json; charset=utf-8": {
            "schema": {
              "$ref": "#/components/schemas/ApiErrors"
            }
          }
        }
      },
      "UnprocessableCreate": {
        "description": "One of the following:\n+ `source` already exists\n+ `display_url` is not a properly formatted url\n+ Combination of `customer_email`, `user.email` and `company.domain` is supplied. Only one of the provided fields is allowed at a time.\n+ User does not exist and cannot be set as note owner\n+ company does not exist and cannot be set on note (when `company.id` has been provided)\n+ cannot set both company `id` and `domain` attributes\n",
        "content": {
          "application/json; charset=utf-8": {
            "schema": {
              "$ref": "#/components/schemas/ApiErrors"
            }
          }
        }
      },
      "RateLimited": {
        "description": "The client's request rate limit has been exceeded",
        "headers": {
          "Retry-After": {
            "description": "The number of seconds to wait until the rate limit will be lifted and the request should be retried",
            "schema": {
              "type": "integer"
            },
            "example": 3600
          }
        }
      }
    }
  },
  "security": [
    {
      "JWT-Token": []
    }
  ]
}
```