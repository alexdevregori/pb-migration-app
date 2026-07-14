# Create a link

Creates a link between the specified note and the specified entity (product, component, feature, or subfeature).

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
    "/notes/{noteId}/links/{entityId}": {
      "post": {
        "summary": "Create a link",
        "description": "Creates a link between the specified note and the specified entity (product, component, feature, or subfeature).",
        "operationId": "createLink",
        "tags": [
          "Notes"
        ],
        "parameters": [
          {
            "$ref": "#/components/parameters/Version"
          },
          {
            "$ref": "#/components/parameters/NoteId"
          },
          {
            "name": "entityId",
            "in": "path",
            "description": "Entity ID (ID of product, component, feature, or subfeature).",
            "required": true,
            "schema": {
              "$ref": "#/components/schemas/UUID"
            }
          }
        ],
        "responses": {
          "201": {
            "description": "Link created"
          },
          "204": {
            "description": "Link already exists"
          },
          "404": {
            "$ref": "#/components/responses/links.error_responses-NotFound"
          }
        }
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
      },
      "NoteId": {
        "name": "noteId",
        "in": "path",
        "required": true,
        "description": "Note identifier.",
        "schema": {
          "$ref": "#/components/schemas/UUID"
        }
      }
    },
    "schemas": {
      "UUID": {
        "type": "string",
        "format": "uuid",
        "description": "Entity identifier.",
        "example": "00000000-0000-0000-0000-000000000000"
      },
      "ApiError": {
        "type": "object",
        "required": [
          "id",
          "status",
          "code",
          "title",
          "detail"
        ],
        "properties": {
          "id": {
            "type": "string",
            "description": "A unique identifier for this particular occurrence of the problem."
          },
          "status": {
            "type": "string",
            "description": "The HTTP status code applicable to this problem, expressed as a string value."
          },
          "code": {
            "type": "string",
            "description": "A unique, machine-readable and stable code that identifies this error. Consult the list below for possible values and their meanings:\n - `note.notFound` - Requested Note could not be found.\n - `entity.notFound` - Requested Entity could not be found.\n\nNote that more detail about what _exactly_ happened is usually provided within the other properties of this\nobject. Consult [Error codes](https://developer.productboard.com/reference/error-codes) if you can't find your error here.\n"
          },
          "title": {
            "type": "string",
            "description": "A short, human-readable summary of the problem that doesn't change from occurrence to occurrence of the problem."
          },
          "detail": {
            "type": "string",
            "description": "A human-readable explanation specific to this occurrence of the problem."
          }
        },
        "example": {
          "id": "00000000-0000-0000-0000-000000000000",
          "status": "404",
          "code": "note.notFound",
          "title": "Note not found",
          "description": "Note with ID '00000000-0000-0000-0000-000000000000' could not be found. It either doesn't exist or you don't have permission to access it."
        }
      },
      "links.error_ApiErrors": {
        "type": "object",
        "required": [
          "errors"
        ],
        "properties": {
          "errors": {
            "type": "array",
            "description": "Errors that occurred.",
            "items": {
              "$ref": "#/components/schemas/ApiError"
            }
          }
        }
      }
    },
    "responses": {
      "links.error_responses-NotFound": {
        "description": "Not found",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/links.error_ApiErrors"
            }
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