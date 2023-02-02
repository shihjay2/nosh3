# NOSH ChartingSystem 3

## Introduction:

NOSH ChartingSystem is an open-source electronic health record that is specifically designed for outpatient clinical practices.  NOSH works equally well as a personal health record due to it's patient-centric framework, but with a user interface that is provider-centric for easy entry of clinical data.

NOSH ChartingSystem 3 is completely redesigned from the ground up.  Whereas NOSH 1 and 2 were LAMP stack applications based on PHP/Laravel, NOSH 3 is now completely based on [Vue.js](https://vuejs.org/) and [CouchDB](https://couchdb.apache.org/)/[PouchDB](https://pouchdb.com/) for the database.  NOSH 3 is also now completely FHIR-based in terms of database structures so that using FHIR API endpoints are native and super quick.
&nbsp;  
## Key Features:

#### 1. Magic link authentication (no passwords!)
#### 2. Encryption at rest in CouchDB with [comdb](https://github.com/garbados/comdb), which uses [TweetNaCl](https://github.com/dchest/tweetnacl-js) for cryptography.
#### 3. [Progressive Web App](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) design with Offline mode in case network goes down.
#### 4. Simple user-specific text snippets and templates (dot phrases).
#### 5. PDF document viewer/editor with [PDFJS](https://github.com/mozilla/pdfjs-dist)
#### 6. Graphs and growth charts with [Highcharts](https://github.com/highcharts/highcharts)
#### 7. Care Opportunites
&nbsp;  
## Preparation:

The easiest way to install NOSH is through [Docker](https://www.docker.com/).  Follow the instructions below based on your operating system for how to download and install Docker Desktop.

#### [Mac](https://docs.docker.com/desktop/install/mac-install/)

#### [Linux](https://docs.docker.com/desktop/install/linux-install/)

#### [Windows](https://docs.docker.com/desktop/install/windows-install/)

Once Docker is installed, follow the next steps.
&nbsp;  

## Installation:

#### 1. Create a new project directory

```
mkdir nosh
cd nosh
```

#### 2. Copy docker-compose.yml from the GitHub repository

```
wget https://raw.githubusercontent.com/shihjay2/nosh3/master/docker-compose.yml
```

#### 3. Edit the docker-compose.yml
```
- "--certificatesresolvers.web.acme.email=example@example.com"
```
#### Line 20: Replace example@example.com with your email address
```
- "traefik.http.routers.nosh.rule=Host(`example.com`)"
- "traefik.http.routers.nosh-secure.rule=Host(`example.com`)"
```
#### Lines 61 & 65: Replace example.com with your domain name

#### 4. Create the environment configuration file (below is an example for a clinical provider instance - mdNOSH)

```
cat << EOF > .env
COUCHDB_URL=http://couchdb:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=my_couchdb_password
COUCHDB_ENCRYPT_PIN=my_couchdb_pin
INSTANCE=local
NOSH_ROLE=provider
AUTH=magic
MAGIC_API_KEY=my_magic_api_key
USPSTF_KEY=my_uspstf_key
UMLS_KEY=my_umls_key
NOSH_DISPLAY="My Name"
NOSH_EMAIL=my@email.address
EOF
```

Below is an example for a patient health record (pNOSH)
```
cat << EOF > .env
COUCHDB_URL=http://couchdb:5984
COUCHDB_USER=admin
COUCHDB_PASSWORD=my_couchdb_password
INSTANCE=digitalocean
NOSH_ROLE=patient
AUTH=magic
MAGIC_API_KEY=my_magic_api_key
USPSTF_KEY=my_uspstf_key
UMLS_KEY=my_umls_key
NOSH_DISPLAY="My Name"
NOSH_EMAIL=my@email.address
NOSH_DID='did:my_decentralized_identifier'
EOF
```

or copy env from the GitHub repository and edit the file

```
wget https://raw.githubusercontent.com/shihjay2/nosh3/master/env
```

#### 5. Start the multi-container application

```
docker compose up -d
```

When the process completes, check that all the containers have successfully started, by running `docker compose ps`. If they are all working correctly, you should see output similar to the one below:
```
Network nosh3_default  Created
Container couchdb      Started
Container watchtower   Started
Container nosh         Started
Container router       Started
```

#### 6. Open your browser and enter
```
http://localhost/start
```
or
```
https://yourdomain.xyz/start
```
if your machine/droplet's public IP address is associated with a domain name.
That's it!

&nbsp;  
# Notes
## What is in docker-compose.yml?
The docker-compose.yml defines the specific containers that when working together, allow NOSH to be able to fully featured (e.g. a bundle).  Below are the different containers and what they do:
#### 1. [Traefik](https://doc.traefik.io/traefik/providers/docker/) - this is the router, specifying the ports and routing to the containers in the bundle 
#### 2. [CouchDB](https://couchdb.apache.org/) - this is the NoSQL database that stores all documents
#### 3. [NOSH](https://github.com/shihjay2/nosh3) - this is the Node.js based server application
#### 4. [Watchtower](https://github.com/containrrr/watchtower) - this service pulls and applies updates to all Docker Images in the bundle automatically
&nbsp;  
## A note on the .env file
| Setting Name | Description | Example
| ------------ | ----------- | -------
| COUCHDB_URL  | URL of CouchDB instance | If using docker-compose, default should be http://127.0.0.1:5984 - Required
| COUCHDB_USER | Admin user of CouchDB instance | Default is 'admin' - Required
| COUCHDB_PASSWORD | Admin user password for CouchDB | Required
| COUCHDB_ENCRYPT_PIN | 4-digt pin for CouchDB encryption/decryption | 1234 - Required. except for digitalocean instance
| INSTANCE | Type of installation | [docker, digitalocean, local] - Required
| AUTH | Default authentication framework | [magic, trustee] - Required
| MAGIC_API_KEY | API Key for magic.link | Used if AUTH=magic
| NOSH_ROLE | Role of initial user | [patient, provider]
| NOSH_DISPLAY | Display name of initial user | "My Name" (enclose in double quotes) - Required
| NOSH_EMAIL | Email address of inital user | my@email.address - Required
| UMLS_KEY | UMLS API Key for SNOMED, LOINC, RXNorm | See Additional API Services for how to get this


## Selecting an authenticator
NOSH 3 no longer has it's own built-in authenticator as there are too many barriers to use and manage with having a built-in email/authentication service.  Furthermore, NOSH would require some administrator user to fix any accounts with forgotten passwords.  If you are a solo provider or a patient hosting their how personal health record, this is just way too much work with increased security risks.  To simplify the authenticaton process AND make more secure (no more brute-force attacks), NOSH now uses Magic Links and JSON Web Tokens where a user enters their email address (the email address that is previously registered in NOSH) and a verification email will be sent so that the user can then verify their identity. A JSON Web Token (JWT) is then generated for time-limited, token-based authentication for the application.  There are 2 authenticator strategies (see below for instructions).  For a personal health record framework, use the Trustee authenticator.  For a medical provider/institution record framework, use Magic.

### [Magic](https://magic.link/) instructions:
#### 1. Set up an account for free by visiting [Magic](https://magic.link).  Click on Start now.
#### 2. Once you are in the [dashboard](https://dashboard.magic.link/app/all_apps), go to Magic Auth and click on New App.  Enter the App Name (NOSH ChartingSystem) and hit Create App.
#### 3. Once you are in the home page for the app, scroll down to API Keys and copy the PUBISHABLE API KEY value.  This API Key will be usee to interact with Magic's APIs as specified in the env file
&nbsp;  
### Trustee instructions:
#### To be determined...
&nbsp;  
## Additional API Services
### [National Library of Medicine UMLS Terminology Services](https://uts.nlm.nih.gov/uts/) - this is to allow search queries for SNOMED CT LOINC, and RXNorm definitions.
#### 1. Set up an account [here](https://uts.nlm.nih.gov/uts/signup-login)
#### 2. [Edit your profile](https://uts.nlm.nih.gov/uts/edit-profile) and click on Generate new API Key.  Copy and enter this in the .env file
&nbsp;  
### [US Preventive Services Task Force](https://www.uspreventiveservicestaskforce.org/apps/api.jsp) - this provides Care Opportunties guidance based on USPSTF guidelines
#### 1. [Visit this site for instructions](https://www.uspreventiveservicestaskforce.org/apps/api.jsp)
&nbsp;  
## Endpoints
#### For all instances besides patient NOSH on DigitalOcean App Platform:
```
https://yourdomain.xyz/start
https://yourdomain.xyz/fhir/api/v1/Patient
https://yourdomain.xyz/fhir/api/v1/Condition
https://yourdomain.xyz/fhir/api/v1/MedicationStatement
https://yourdomain.xyz/fhir/api/v1/AllergyIntolerance
https://yourdomain.xyz/fhir/api/v1/Immunization
```
#### For patient NOSH on DigitalOcean App Platform:
```
https://nosh-app-xxx.ondigitalocean.app/app/chart/nosh_xxx
https://nosh-app-xxx.ondigitalocean.app/api/nosh_xxx/Patient
https://nosh-app-xxx.ondigitalocean.app/api/nosh_xxx/Condition
https://nosh-app-xxx.ondigitalocean.app/api/nosh_xxx/MedicationStatement
https://nosh-app-xxx.ondigitalocean.app/api/nosh_xxx/AllergyIntolerance
https://nosh-app-xxx.ondigitalocean.app/api/nosh_xxx/Immunization
```
#### where nosh_xxx refers to the patient ID.
#### For MD NOSH, there is a dashboard endpoint
```
https://yourdomain.xyz/app/dashboard
```

&nbsp;  
## Contributing To NOSH ChartingSystem

**All issues and pull requests should be filed on the [shihjay2/nosh3](http://github.com/shihjay2/nosh3) repository.**
&nbsp;  
&nbsp;  
## License

NOSH ChartingSystem is open-sourced software licensed under the [GNU Affero General Public License](http://www.gnu.org/licenses/)
