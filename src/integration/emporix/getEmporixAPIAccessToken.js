export const getEmporixAPIAccessToken = async () => {
  const emporixAccessToken = localStorage.getItem('emporixAccessToken')
  const emporixAccessTokenExpiresAt = localStorage.getItem(
    'emporixAccessTokenExpiresAt'
  )
    ? parseInt(localStorage.getItem('emporixAccessTokenExpiresAt'))
    : null
  if (
    !isNaN(emporixAccessTokenExpiresAt) &&
    typeof emporixAccessTokenExpiresAt === 'number' &&
    new Date().getTime() <= emporixAccessTokenExpiresAt &&
    emporixAccessToken
  ) {
    return emporixAccessToken
  }
  const formData = {
    client_id: process.env.REACT_APP_EMPORIX_CLIENT_ID,
    client_secret: process.env.REACT_APP_EMPORIX_CLIENT_SECRET,
    grant_type: 'client_credentials',
  }
  try {
    const responseRaw = await fetch(
      `${process.env.REACT_APP_API_URL}/oauth/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formData).toString(),
      }
    )
    if (responseRaw.status !== 200) {
      throw {
        error: 'Could not get access token',
      }
    }
    const responseJSON = await responseRaw.json()
    const { expires_in, access_token: newAccessToken } = responseJSON
    localStorage.setItem('emporixAccessToken', newAccessToken)
    localStorage.setItem(
      'emporixAccessTokenExpiresAt',
      //180 second error margin
      new Date().getTime() + (expires_in - 180) * 1000
    )
    return newAccessToken
  } catch (e) {
    console.log(111, e)
    throw 'could not get emporix access token'
  }
}
