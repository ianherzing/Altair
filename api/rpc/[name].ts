import type { VercelRequest, VercelResponse } from '@vercel/node'

import addConsultantCostRate from '../_rpc/add-consultant-cost-rate.js'
import addHoliday from '../_rpc/add-holiday.js'
import addPassionArea from '../_rpc/add-passion-area.js'
import addSkill from '../_rpc/add-skill.js'
import addUserRole from '../_rpc/add-user-role.js'
import archiveProjects from '../_rpc/archive-projects.js'
import createAssignment from '../_rpc/create-assignment.js'
import createComment from '../_rpc/create-comment.js'
import createConsultant from '../_rpc/create-consultant.js'
import createProject from '../_rpc/create-project.js'
import deleteAssignment from '../_rpc/delete-assignment.js'
import deleteComment from '../_rpc/delete-comment.js'
import deleteConsultantCostRate from '../_rpc/delete-consultant-cost-rate.js'
import deleteConsultantSkill from '../_rpc/delete-consultant-skill.js'
import deleteHoliday from '../_rpc/delete-holiday.js'
import deleteProject from '../_rpc/delete-project.js'
import deleteView from '../_rpc/delete-view.js'
import listViews from '../_rpc/list-views.js'
import removeUserRole from '../_rpc/remove-user-role.js'
import saveView from '../_rpc/save-view.js'
import sendSchedulingEmail from '../_rpc/send-scheduling-email.js'
import updateAssignment from '../_rpc/update-assignment.js'
import updateConsultant from '../_rpc/update-consultant.js'
import updateConsultantCountry from '../_rpc/update-consultant-country.js'
import updateConsultantPassion from '../_rpc/update-consultant-passion.js'
import updateConsultantUtilizationTarget from '../_rpc/update-consultant-utilization-target.js'
import updateOwnMentor from '../_rpc/update-own-mentor.js'
import updateProject from '../_rpc/update-project.js'
import updateUserRole from '../_rpc/update-user-role.js'
import upsertConsultantSkill from '../_rpc/upsert-consultant-skill.js'

type Handler = (req: VercelRequest, res: VercelResponse) => unknown | Promise<unknown>

const handlers: Record<string, Handler> = {
  'add-consultant-cost-rate': addConsultantCostRate,
  'add-holiday': addHoliday,
  'add-passion-area': addPassionArea,
  'add-skill': addSkill,
  'add-user-role': addUserRole,
  'archive-projects': archiveProjects,
  'create-assignment': createAssignment,
  'create-comment': createComment,
  'create-consultant': createConsultant,
  'create-project': createProject,
  'delete-assignment': deleteAssignment,
  'delete-comment': deleteComment,
  'delete-consultant-cost-rate': deleteConsultantCostRate,
  'delete-consultant-skill': deleteConsultantSkill,
  'delete-holiday': deleteHoliday,
  'delete-project': deleteProject,
  'delete-view': deleteView,
  'list-views': listViews,
  'remove-user-role': removeUserRole,
  'save-view': saveView,
  'send-scheduling-email': sendSchedulingEmail,
  'update-assignment': updateAssignment,
  'update-consultant': updateConsultant,
  'update-consultant-country': updateConsultantCountry,
  'update-consultant-passion': updateConsultantPassion,
  'update-consultant-utilization-target': updateConsultantUtilizationTarget,
  'update-own-mentor': updateOwnMentor,
  'update-project': updateProject,
  'update-user-role': updateUserRole,
  'upsert-consultant-skill': upsertConsultantSkill,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const name = req.query.name
  if (typeof name !== 'string') {
    return res.status(400).json({ error: 'Invalid route' })
  }
  const fn = handlers[name]
  if (!fn) {
    return res.status(404).json({ error: 'Not found' })
  }
  return fn(req, res)
}
