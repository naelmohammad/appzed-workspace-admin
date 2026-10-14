# AppZed Workspace Admin Agent

Runs onboarding and offboarding checklists across accounts and licenses. HR events become trackable checklists, with role-specific items drafted by AI. Schema self-initializes.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/naelmohammad/appzed-workspace-admin)

Click **Deploy to Cloudflare**: it clones this repo to your GitHub account, provisions the bindings below on your Cloudflare account, and wires CI/CD with preview URLs on every PR.

## Bindings (auto-provisioned)

```jsonc
{
  "name": "appzed-workspace-admin",
  "ai": {
    "binding": "AI"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "appzed-workspace-admin-meta"
    }
  ]
}
```

## Try it

```bash
curl -X POST https://<your-worker>.workers.dev/events \
  -H 'content-type: application/json' \
  -d '{"person":"Sara","kind":"onboarding","role":"support engineer"}'

curl https://<your-worker>.workers.dev/checklists
```

GET /health for a liveness check. Managed by AppZed (https://dev.appzed.com/solutions/workspace-admin).
