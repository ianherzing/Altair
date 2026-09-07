import { makeRpcHandler } from '../_lib/make-rpc-handler.js'
import { isUUID, isNum } from '../_lib/validate.js'

export default makeRpcHandler({
  rpcName: 'update_consultant_utilization_target',
  fields: {
    consultant_id: {
      rpcParam: 'p_consultant_id',
      validate: isUUID,
      invalid: 'consultant_id must be a valid UUID',
    },
    target: {
      rpcParam: 'p_target',
      validate: (v) => isNum(v, 0, 100),
      invalid: 'target must be a number between 0 and 100',
    },
  },
  audit: {
    action: 'update',
    resource: 'consultants',
    build: (body) => ({
      resource_id: body.consultant_id as string,
      details: { field: 'utilization_target', value: body.target },
    }),
  },
  authz: { resource: 'consultants', action: 'update' },
})
