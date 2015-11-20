When creating a new release:

* Changes to the manifest:
    * Increase `version`
    * Remove `key`
    * Replace the `oauth2.client_id` value with the `oauth2.live_client_id` value
    * Remove `oauth2.dev_client_id` and `oauth2.live_client_id`
    * Create ZIP
    * Undo all but `version`
    * Commit "Version M.N"
