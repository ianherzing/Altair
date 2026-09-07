import { makeRpcHandler } from '../_lib/make-rpc-handler.js'
import { isString } from '../_lib/validate.js'

export default makeRpcHandler({
  rpcName: 'add_skill',
  fields: {
    name: {
      rpcParam: 'p_name',
      validate: (v) => isString(v, 255),
      invalid: 'name must be a non-empty string with max length 255',
    },
  },
  audit: { action: 'create', resource: 'skills' },
  authz: { resource: 'skills', action: 'create' },
})
