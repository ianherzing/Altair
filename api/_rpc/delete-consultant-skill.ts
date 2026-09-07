import { makeRpcHandler } from '../_lib/make-rpc-handler.js'
import { isUUID } from '../_lib/validate.js'

export default makeRpcHandler({
  rpcName: 'delete_consultant_skill',
  fields: {
    consultant_id: {
      rpcParam: 'p_consultant_id',
      validate: isUUID,
      invalid: 'consultant_id must be a valid UUID',
    },
    skill_id: {
      rpcParam: 'p_skill_id',
      validate: isUUID,
      invalid: 'skill_id must be a valid UUID',
    },
  },
  audit: {
    action: 'delete',
    resource: 'consultant_skills',
    build: (body) => ({
      details: { consultant_id: body.consultant_id, skill_id: body.skill_id },
    }),
  },
  authz: { resource: 'consultant_skills', action: 'delete' },
})
