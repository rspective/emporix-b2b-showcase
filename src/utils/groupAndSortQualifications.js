import { compact, sortBy } from 'lodash'

export const groupAndSortQualifications = (qualifications) => {
  const loyaltyCards = qualifications
    .filter((qualification) => qualification.type === 'LOYALTY_CARD')
    .map((loyaltyCard) => ({
      ...loyaltyCard,
      rewardCampaignsIds: compact(
        loyaltyCard.rewards.map(
          (reward) => reward?.reward?.parameters?.campaign?.id
        )
      ),
    }))
  const groups = {}
  let result = loyaltyCards
  qualifications
    .filter((qualification) => qualification.type !== 'LOYALTY_CARD')
    .forEach((qualification) => {
      const loyaltyCard = result.find((resultQualification) =>
        resultQualification.rewardCampaignsIds?.includes?.(
          qualification.campaign_id
        )
      )
      if (!loyaltyCard) {
        return result.push(qualification)
      }
      if (groups[loyaltyCard.id]) {
        groups[loyaltyCard.id] = [...groups[loyaltyCard.id], qualification]
      } else {
        groups[loyaltyCard.id] = [qualification]
      }
    })
  Object.entries(groups).forEach((qualificationIdAndQualifications) => {
    const [id, qualifications] = qualificationIdAndQualifications
    const indexOfLoyaltyCard = result.findIndex(
      (resultQualification) => resultQualification.id === id
    )
    if (typeof indexOfLoyaltyCard !== 'number' || indexOfLoyaltyCard < 0) {
      return console.log('indexOfLoyaltyCard not found :/')
    }
    result = [
      ...result.slice(0, indexOfLoyaltyCard + 1),
      ...qualifications.sort((q1, q2) => {
        try {
          return (
            new Date(q1.created_at).getTime() <
            new Date(q2.created_at).getTime()
          )
        } catch (e) {
          console.log(e)
          return false
        }
      }),
      ...result.slice(indexOfLoyaltyCard + 1),
    ]
  })
  return result
}
