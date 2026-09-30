/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Idempotent create: skip collection creation if it already exists (task 1.6).
  let collection
  try {
    collection = app.findCollectionByNameOrId("pbc_apps")
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
          "id": "text3901000001",
          "max": 64,
          "min": 1,
          "name": "app_id",
          "pattern": "^[a-z][a-z0-9_]*$",
          "presentable": true,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3901000002",
          "max": 253,
          "min": 1,
          "name": "share_host",
          "pattern": "^[a-z0-9.-]+$",
          "presentable": true,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "autogeneratePattern": "",
          "hidden": false,
          "id": "text3901000003",
          "max": 253,
          "min": 1,
          "name": "allowed_host",
          "pattern": "^[a-z0-9.-]+$",
          "presentable": true,
          "primaryKey": false,
          "required": true,
          "system": false,
          "type": "text"
        },
        {
          "hidden": false,
          "id": "json3901000004",
          "maxSize": 0,
          "name": "url_template",
          "presentable": false,
          "required": true,
          "system": false,
          "type": "json"
        },
        {
          "hidden": false,
          "id": "number3901000005",
          "max": null,
          "min": 1,
          "name": "daily_create_limit",
          "onlyInt": true,
          "presentable": false,
          "required": false,
          "system": false,
          "type": "number"
        },
        {
          "hidden": false,
          "id": "bool3901000006",
          "name": "active",
          "presentable": false,
          "required": false,
          "system": false,
          "type": "bool"
        }
      ],
      "id": "pbc_apps",
      "indexes": [
        "CREATE UNIQUE INDEX `idx_apps_app_id` ON `apps` (`app_id`)",
        "CREATE UNIQUE INDEX `idx_apps_share_host` ON `apps` (`share_host`)"
      ],
      "listRule": null,
      "name": "apps",
      "system": false,
      "type": "base",
      "updateRule": null,
      "viewRule": null
    })

    app.save(collection)
  }

  // Seed rows as a JSON constant so tests validate the exact same data the
  // migration inserts (task 1.7). Insert is skipped for app_ids already present.
  const SEED_JSON = '[{"app_id":"macrolattice","share_host":"sh.macrolattice.com","allowed_host":"macrolattice.com","url_template":{"meal":"https://macrolattice.com/meal/{contentId}"},"daily_create_limit":100,"active":true},{"app_id":"supatrainer","share_host":"sh.supatrainer.com","allowed_host":"supatrainer.com","url_template":{"workout":"https://supatrainer.com/workout/{contentId}"},"daily_create_limit":100,"active":true},{"app_id":"azurechip","share_host":"sh.azurechip.com","allowed_host":"azurechip.com","url_template":{"screen":"https://azurechip.com/screen/{contentId}"},"daily_create_limit":100,"active":true}]'

  for (const seed of JSON.parse(SEED_JSON)) {
    try {
      app.findFirstRecordByFilter("apps", 'app_id = "' + seed.app_id + '"')
    } catch {
      const record = new Record(collection)
      record.set("app_id", seed.app_id)
      record.set("share_host", seed.share_host)
      record.set("allowed_host", seed.allowed_host)
      record.set("url_template", seed.url_template)
      record.set("daily_create_limit", seed.daily_create_limit)
      record.set("active", seed.active)
      app.save(record)
    }
  }

  return collection
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_apps")

  return app.delete(collection)
})
