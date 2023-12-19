import { compact } from 'lodash'

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
  let result = loyaltyCards
  qualifications
    .filter((qualification) => qualification.type !== 'LOYALTY_CARD')
    .forEach((qualification) => {
      const indexOfLoyaltyCard = result.findIndex((resultQualification) =>
        resultQualification.rewardCampaignsIds?.includes?.(
          qualification.campaign_id
        )
      )
      if (typeof indexOfLoyaltyCard !== 'number' || indexOfLoyaltyCard < 0) {
        result.push(qualification)
      } else {
        result = [
          ...result.slice(0, indexOfLoyaltyCard + 1),
          qualification,
          ...result.slice(indexOfLoyaltyCard + 1),
        ]
      }
    })
  return result
}
