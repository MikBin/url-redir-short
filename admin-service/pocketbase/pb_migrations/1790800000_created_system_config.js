/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Task 2.5: `system_config` is the server-side home of the circuit-breaker
  // flag (`public_creation_paused`) per security-profile §4.3 (T0-locked,
  // read/written server-side only). Idempotent create like the apps migration
  // (task 1.6): skip creation when the collection already exists.
  let collection
  try {
    collection = app.findCollectionByNameOrId("pbc_system_config")
  } catch {
    collection = new Collection({
      "createRule": null,
      "deleteRule": null,
      "fields": [
        {
          "autogeneratePattern": "[a-z0-9]{15}",
          "hidden": false,
          "id": "text3208210256",
          "max": 15,
          "min": 15,
          "name": "id",
          "pattern": "^[a-z0-9]+$",
          "presentable": false,
          "primaryKey": true,
          "required": true,
          "system": true,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3902000001",
          "max": 64,
          "min": 1,
          "name": "key",
          "pattern": "^[a-z][a-z0-9_]*$",
          "presentable": true,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "json3902000002",
          "maxSize": 0,
          "name": "value",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "json"
        },
        {
          "hidden": false,
          "id": "autodate3902000003",
          "name": "created",
          "onCreate": true,
          "onUpdate": false,
          "presentable": false,
          "system": false,
          "type": "autodate"
        },
        {
          "hidden": false,
          "id": "autodate3902000004",
          "name": "updated",
          "onCreate": true,
          "onUpdate": true,
          "presentable": false,
          "system": false,
          "type": "autodate"
        }
      ],
      "id": "pbc_system_config",
      "indexes": ["CREATE UNIQUE INDEX `idx_system_config_key` ON `system_config` (`key`)"],
      "listRule": null,
      "name": "system_config",
      "system": false,
      "type": "base",
      "updateRule": null,
      "viewRule": null
    })

    app.save(collection)
  }

  // Seed as a JSON constant so tests validate the exact same data the
  // migration inserts (task 1.7). Insert is skipped when the key exists.
  const SEED_JSON = '[{"key":"public_creation_paused","value":false}]'

  for (const seed of JSON.parse(SEED_JSON)) {
    try {
      app.findFirstRecordByFilter("system_config", 'key = "' + seed.key + '"')
    } catch {
      const record = new Record(collection)
      record.set("key", seed.key)
      record.set("value", seed.value)
      app.save(record)
    }
  }

  return null
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_system_config")

  return app.delete(collection)
})
