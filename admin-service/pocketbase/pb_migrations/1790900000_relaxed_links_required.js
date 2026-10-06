/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  // Task 2.9: anonymous share creates persist links without a legacy owner or
  // legacy destination. The share-pivot fields are the new truth (app,
  // destination_url, content_ref); `destination` and `owner_id` were required
  // by the pre-pivot schema and would block every anonymous insert. Relaxing
  // required flags is additive for existing rows (no data rewrite).
  const collection = app.findCollectionByNameOrId("pbc_links")

  // getByName returns null (no throw) for missing fields in the JSVM.
  const relaxField = (name) => {
    const field = collection.fields.getByName(name)
    if (field !== null && field.required === true) {
      field.required = false
      return true
    }
    return false
  }

  relaxField("destination")
  relaxField("owner_id")

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_links")

  const requireField = (name) => {
    const field = collection.fields.getByName(name)
    if (field !== null && field.required === false) {
      field.required = true
      return true
    }
    return false
  }

  requireField("destination")
  requireField("owner_id")

  return app.save(collection)
})
