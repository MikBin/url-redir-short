/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_links")

  // C1 fix (task 1.1): lock the links collection — superuser-only via the
  // data plane; public writes go exclusively through the purpose-built
  // share/create route (security-profile-pocketbase-cf.md §4.3, L2 lock-by-default).
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_links")

  // Deliberately stays locked on rollback: re-opening any-authenticated
  // CRUD would restore the cross-tenant bypass this migration fixes.
  unmarshal({
    "createRule": null,
    "deleteRule": null,
    "listRule": null,
    "updateRule": null,
    "viewRule": null
  }, collection)

  return app.save(collection)
})
