# About and motivation
Finding a good home to rent in some cities has become a really complex task. Nowadays we have more and more sites publishing houses, but their alerts services are either not inmediate or simply not accurate.
This is a very simple NodeJS recurrent task wich will keep track of every new flat added to an Idealista URL and email you an alert if it passes your filter.

The goal is to be the first doing the call and visiting your dream home! ;)

# Requirements
[npm](https://www.npmjs.com/) and [NodeJS](https://nodejs.org/en/). Get both [here](https://nodejs.org/en/download/)!

# Get the repo
    git clone https://github.com/yeikiu/cronIdealista.git
    cd cronIdealista

# Install dependencies
    npm install

# Customize your config files
Before sending your email using gmail you have to allow non secure apps to access gmail you can do this by going to your gmail settings [here](https://myaccount.google.com/lesssecureapps).
## config_email.json
    {
        "mail": {
            "service": "gmail",
            "auth": {
                "user": "<YOUR_GMAIL>@gmail.com",
                "pass": "<YOUR_PASSWORD>"
            }
        }
    }
I'm using Gmail as a provider since it was extremly easy to configure my account following [this great post](https://medium.com/@manojsinghnegi/sending-an-email-using-nodemailer-gmail-7cfa0712a799) by [Manoj Singh Negi](https://medium.com/@manojsinghnegi). But you should be able to configure any smtp provider digging in [Nodemailer's documentation](https://nodemailer.com/smtp/).

## config_jobs.json
    [{
        "name": "Idealista JOB Las Palmas",
        "init_url": "https://www.idealista.com/alquiler-viviendas/las-palmas-de-gran-canaria-las-palmas/con-publicado_ultimas-24-horas/?ordenado-por=fecha-publicacion-desc",
        "max_pages": 5,
        "output_json_file": "items_idealista_las_palmas.json",
        "destinataries": [
            {
                "name": "Joe Blogs",
                "email": "<example1>@gmail.com",
                "filters": {
                    "price": "< 601",
                    "m2": "> 40",
                    "num_rooms": "> 1"
                }
            },
            {
                "name": "Joe's friend",
                "email": "<example2>@gmail.com",
                "filters": {
                    "price": "< 601",
                    "m2": "> 30"
                }
            }
        ]
    }, {
        "name": "Idealista JOB Barcelona",
        "init_url": "https://www.idealista.com/alquiler-viviendas/barcelona-barcelona/con-publicado_ultimas-24-horas/?ordenado-por=fecha-publicacion-desc",
        "max_pages": 5,
        "output_json_file": "items_idealista_barcelona.json",
        "destinataries": [
            {
                "name": "John Smith",
                "email": "<example3>@gmail.com",
                "filters": {
                    "price": "< 601",
                    "m2": "> 40",
                    "num_rooms": "> 1"
                }
            }
        ]
    }]

This file is an array of Jobs to be iterated by the cron on each execution. Each job has the following fields:

| Key | Definition |
|--|--|
| **name** | Will identify the job in the console output and the email alerts subject |
| **init_url** | The first Idealista's page to be visited by the scrapper. For example I use [this url](https://www.idealista.com/alquiler-viviendas/las-palmas-de-gran-canaria-las-palmas/con-publicado_ultimas-24-horas/?ordenado-por=fecha-publicacion-desc) to be updated with the new flats in my city Las Palmas de Gran Canaria. Visit the link and notice the web must show in it's list view, not the map. The next pages to visit will be identified if there is a 'next page' button in the pager of the list. |
| **max_pages** | Limit the number of pages to be visited. Don't be greedy ;) |
| **output_json_file** | This file will be generated with all the flats scrapped during the job. The first time the job runs it won't notify the configured destinataries since we are looking for fresh additions. After the second run, when it detects a new flat to insert in the file, it will notify those destinataries matching their filters criteria. |
| **destinataries** | Here you can set any number of destinataries interested in the alerts generated. Each destinatary has a **name** and an **email** field. The **filters** field must exist but it's not mandatory to fill it with any data. |
| **destinatary filters** | At the moment you can only use numeric comparison expressions for the following fields: **price**, **m2** and **num_rooms**. |

# Enjoy scrapping!
    node cronIdealista
