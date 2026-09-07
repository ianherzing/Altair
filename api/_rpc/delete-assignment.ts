import { makeRpcHandler } from '../_lib/make-rpc-handler.js'
import { isUUID } from '../_lib/validate.js'

export default makeRpcHandler({
  rpcName: 'delete_assignment',
  fields: {
    id: {
      rpcParam: 'p_id',
      validate: isUUID,
      invalid: 'id must be a valid UUID',
    },
  },
  audit: {
    action: 'delete',
    resource: 'assignments',
    build: (body) => ({ resource_id: body.id as string }),
  },
  authz: { resource: 'assignments', action: 'delete' },
})
