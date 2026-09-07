import { makeRpcHandler } from '../_lib/make-rpc-handler.js'
import { isUUID } from '../_lib/validate.js'

export default makeRpcHandler({
  rpcName: 'delete_consultant_cost_rate',
  fields: {
    cost_rate_id: {
      rpcParam: 'p_cost_rate_id',
      validate: isUUID,
      invalid: 'cost_rate_id must be a valid UUID',
    },
  },
  audit: {
    action: 'delete',
    resource: 'consultant_cost_rates',
    build: (body) => ({ resource_id: body.cost_rate_id as string }),
  },
  authz: { resource: 'consultant_cost_rates', action: 'delete' },
})
