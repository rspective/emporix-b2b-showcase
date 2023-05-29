import { GridLayout, Center } from '../components/Utilities/common'
import { Heading4, Heading5 } from '../components/Utilities/typography'
import { TextInput } from '../components/Utilities/input'
import { LargePrimaryButton } from '../components/Utilities/button'
import { useCallback, useState } from 'react'
import {
  STOREFRONT_CLIENT_ID,
  EMPORIX_CLIENT_ID,
  EMPORIX_SECRET_KEY,
  TENANT,
} from 'constants/localstorage'
const DEVPORTAL_URL = process.env.REACT_APP_DEVPORTAL_URL
const InvalidTenant = () => {
  const [tenant, setTenant] = useState('')
  const [storefrontClientId, setStorefrontClientId] = useState('')
  const [emporixClientId, setEmporixClientId] = useState('')
  const [emporixSecretKey, setEmporixSecretKey] = useState('')

  const saveConfig = useCallback(() => {
    localStorage.setItem(STOREFRONT_CLIENT_ID, storefrontClientId)
    localStorage.setItem(TENANT, tenant)
    localStorage.setItem(EMPORIX_CLIENT_ID, emporixClientId)
    localStorage.setItem(EMPORIX_SECRET_KEY, emporixSecretKey)
    window.location.replace(`/${tenant}`)
  }, [storefrontClientId, tenant, emporixClientId, emporixSecretKey])

  return (
    <GridLayout className="invalid-tenant-page bg-gray">
      <GridLayout className="gap-20 place-content-center">
        <Heading4 className="">
          You need to enter a valid tenant name in the URL.
        </Heading4>
        <Center className="gap-3 w-1/3 m-auto">
          <TextInput
            label="Tenant Name"
            value={tenant}
            placeholder="Please put tenant name"
            action={setTenant}
          />
          <TextInput
            label="Storefront API Client ID"
            value={storefrontClientId}
            placeholder="Please put client id"
            action={setStorefrontClientId}
          />
          <TextInput
            label="Emporix API Client ID"
            value={emporixClientId}
            placeholder="Please put tenant name"
            action={setEmporixClientId}
          />
          <TextInput
            label="Emporix API Secret"
            value={emporixSecretKey}
            placeholder="Please put client id"
            action={setEmporixSecretKey}
          />
          <LargePrimaryButton
            title="MAIN PAGE"
            className="mt-8"
            onClick={() => saveConfig()}
          />
        </Center>
        <Heading5 className="text-black">
          You can obtain api keys{' '}
          <a target="_blank" className="text-tinBlue" href={DEVPORTAL_URL}>
            here
          </a>{' '}
        </Heading5>
      </GridLayout>
    </GridLayout>
  )
}
export default InvalidTenant
