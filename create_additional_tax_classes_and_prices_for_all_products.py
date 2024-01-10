import requests
from dotenv import load_dotenv
load_dotenv()
import os

country1 = "US"
country2 = "CA"

# Externalized variables
tenant = os.getenv('REACT_APP_EMPORIX_TENANT')
client_id = os.getenv('REACT_APP_EMPORIX_CLIENT_ID')
client_secret = os.getenv('REACT_APP_EMPORIX_CLIENT_SECRET')

base_url = "https://api.emporix.io"
ca_tax_class = "ZERO"

# Get the Access Token
def get_access_token():
    url = f"{base_url}/oauth/token"
    headers = {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    data = {
        'grant_type': 'client_credentials',
        'client_id': {client_id},
        'client_secret': {client_secret}
    }

    response = requests.post(url, headers=headers, data=data)
    if response.status_code == 200:
        return response.json()['access_token']
    else:
        raise Exception(f"Failed to get access token: {response.status_code} {response.reason}")

headers = {
    'Accept-Language': '*',
    'x-version': 'v2',
    'Authorization': f'Bearer {get_access_token()}'
}

# Function to check response for errors
def handle_response_error(response):
    if not response.ok:
        raise Exception(f"Error with request: {response.status_code} {response.reason} - {response.text}")

# Step 1: Get the first 1000 products
product_url = f"{base_url}/product/{tenant}/products?sort=name:DESC&pageNumber=1&pageSize=1000&q="
response = requests.get(product_url, headers=headers)
handle_response_error(response)
products = response.json()

for product in products:
    product_id = product["id"]

    # Step 2: Get the taxClasses of the product
    tax_class_url = f"{base_url}/product/{tenant}/products/{product_id}?fields=taxClasses"
    tax_class_response = requests.get(tax_class_url, headers=headers)
    print(1, tax_class_response)
    tax_classes = tax_class_response.json()["taxClasses"]

    # Step 3: Add the CA new tax class for that product
    tax_classes["US"] = ca_tax_class
    patch_url = f"{base_url}/product/{tenant}/products/{product_id}"
    patch_data = {"taxClasses": tax_classes, "id": product_id}
    a = requests.patch(patch_url, headers=headers, json=patch_data)
    print(2, a)


    # Step 4: Get the product tier value prices from the main site in euro for the product
    price_url = f"{base_url}/price/{tenant}/prices/?siteCode=main&country=DE&currency=USD&itemId={product_id}"
    price_response = requests.get(price_url, headers=headers)
    print(3, price_response)
    priceResponseJson = price_response.json()
    print(priceResponseJson)
    print(product_id)
    if len(priceResponseJson) > 0:
        tier_values=priceResponseJson[0]["tierValues"]

        # Step 5: Create on new product price for country: CA and site codes:CA in EUR
        post_price_url = f"{base_url}/price/{tenant}/prices/"
        post_data = {
            "itemId": {"id": product_id, "itemType": "PRODUCT"},
            "currency": "USD",
            "location": {"countryCode": country1},
            "restrictions": {"siteCodes": ["main"]},
            "tierValues": tier_values
        }
        x = requests.post(post_price_url, headers=headers, json=post_data)
        print(4,x)
        post_data = {
            "itemId": {"id": product_id, "itemType": "PRODUCT"},
            "currency": "USD",
            "location": {"countryCode": country2},
            "restrictions": {"siteCodes": ["main"]},
            "tierValues": tier_values
        }
        x = requests.post(post_price_url, headers=headers, json=post_data)
        print(4,x)
