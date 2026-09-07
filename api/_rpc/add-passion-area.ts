import { makeRpcHandler } from '../_lib/make-rpc-handler.js'
import { isString } from '../_lib/validate.js'

export default makeRpcHandler({
  rpcName: 'add_passion_area',
  fields: {
    name: {
      rpcParam: 'p_name',
      validate: (v) => isString(v, 255),
      invalid: 'name must be a non-empty string with max length 255',
    },
  },
  audit: { action: 'create', resource: 'passion_areas' },
  authz: { resource: 'passion_areas', action: 'create' },
})
