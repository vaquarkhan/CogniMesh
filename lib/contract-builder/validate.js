"use strict";

const Ajv2020 = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const fs = require("fs");
const path = require("path");

let _validate = null;

function getValidator() {
  if (_validate) return _validate;
  const schemaPath = path.join(__dirname, "..", "..", "schemas", "data-contract-v1.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  _validate = ajv.compile(schema);
  return _validate;
}

function validateContract(contract) {
  const validate = getValidator();
  const valid = validate(contract);
  return {
    valid,
    errors: valid
      ? []
      : (validate.errors || []).map((e) => ({
          path: e.instancePath || "/",
          message: e.message,
        })),
  };
}

module.exports = { validateContract };
