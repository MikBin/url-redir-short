/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Task 1.5: extend links for the share pivot. Idempotent: fields and the
  // unique index are only added when absent (task 1.6).
  const collection = app.findCollectionByNameOrId("pbc_links")

  // getByName returns null (no throw) for missing fields in the JSVM.
  const hasField = (name) => Boolean(collection.fields.getByName(name))

  if (!hasField("app")) {
    collection.fields.add(new Field({
      "cascadeDelete": false,
      "collectionId": "pbc_apps",
      "hidden": false,
      "id": "relation3901000007",
      "maxSelect": 1,
      "minSelect": 0,
      "name": "app",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "relation"
    }))
  }

  if (!hasField("content_ref")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "json3901000008",
      "maxSize": 0,
      "name": "content_ref",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "json"
    }))
  }

  if (!hasField("destination_url")) {
    collection.fields.add(new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text3901000009",
      "max": 2048,
      "min": 0,
      "name": "destination_url",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
  }

  if (!hasField("last_click_at")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "date3901000010",
      "max": "",
      "min": "",
      "name": "last_click_at",
      "presentable": false,
      "required": false,
      "system": false,
      "type": "date"
    }))
  }

  if (!hasField("created_from_ip")) {
    collection.fields.add(new Field({
      "autogeneratePattern": "",
      "hidden": false,
      "id": "text3901000011",
      "max": 64,
      "min": 0,
      "name": "created_from_ip",
      "pattern": "",
      "presentable": false,
      "primaryKey": false,
      "required": false,
      "system": false,
      "type": "text"
    }))
  }

  // §4.1 purge reads `created` for the 30-clickless-day window; PB base
  // collections do not track it unless declared (no autodate fields by default).
  if (!hasField("created")) {
    collection.fields.add(new Field({
      "hidden": false,
      "id": "autodate3901000012",
      "name": "created",
      "onCreate": true,
      "onUpdate": false,
      "presentable": false,
      "system": false,
      "type": "autodate"
    }))
  }

  // slug uniqueness is scoped per app: host-keyed KV keys make the same slug
  // on two share hosts independent (spec: same-slug-on-two-apps scenario).
  const appSlugIndex = "CREATE UNIQUE INDEX `idx_links_app_slug` ON `links` (`app`, `slug`)"
  if (!collection.indexes.includes(appSlugIndex)) {
    unmarshal({
      "indexes": [...collection.indexes, appSlugIndex]
    }, collection)
  }

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_links")

  for (const fieldId of [
    "relation3901000007",
    "json3901000008",
    "text3901000009",
    "date3901000010",
    "text3901000011",
    "autodate3901000012"
  ]) {
    try {
      collection.fields.removeById(fieldId)
    } catch {
      // Field already absent.
    }
  }

  unmarshal({
    "indexes": collection.indexes.filter((index) => !index.includes("idx_links_app_slug"))
  }, collection)

  return app.save(collection)
})
