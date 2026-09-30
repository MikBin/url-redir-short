/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
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
  });

  const saved = app.save(collection);

  // Seed the three first-party apps (ADR-007). url_template maps a share
  // type to a destination template; {contentId} is substituted server-side
  // by the create route's renderer (task 2.2), params become query string.
  const seeds = [
    {
      app_id: "macrolattice",
      share_host: "sh.macrolattice.com",
      allowed_host: "macrolattice.com",
      url_template: { meal: "https://macrolattice.com/meal/{contentId}" }
    },
    {
      app_id: "supatrainer",
      share_host: "sh.supatrainer.com",
      allowed_host: "supatrainer.com",
      url_template: { workout: "https://supatrainer.com/workout/{contentId}" }
    },
    {
      app_id: "azurechip",
      share_host: "sh.azurechip.com",
      allowed_host: "azurechip.com",
      url_template: { screen: "https://azurechip.com/screen/{contentId}" }
    }
  ];

  for (const seed of seeds) {
    const record = new Record(saved);
    record.set("app_id", seed.app_id);
    record.set("share_host", seed.share_host);
    record.set("allowed_host", seed.allowed_host);
    record.set("url_template", seed.url_template);
    record.set("daily_create_limit", 100);
    record.set("active", true);
    app.save(record);
  }

  return saved;
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_apps");

  return app.delete(collection);
})
