import type { Client, Session, GasLog, MaintenanceLog, Equipment } from "./store";

const mockClients: Client[] = [
  {
    "id": "a569006b-669c-4e3c-88b9-01bff9a608bd",
    "name": "rands pamela",
    "address": "7 white birch",
    "phone": "(555) 123-4567",
    "email": "pamela.rands@email.com",
    "contractLength": "6 months",
    "sqft": "4500",
    "billingType": "PerCut",
    "amount": 25,
    "notes": "",
    "createdAt": "2025-07-19T18:29:42.138Z"
  },
  {
    "id": "30694879-913e-49fd-aa2a-1e8c9118e727",
    "name": "80 southpine",
    "address": "80 southpine",
    "phone": "(555) 987-6543",
    "email": "contact@southpine.com",
    "contractLength": "Yearly",
    "sqft": "8200",
    "billingType": "Regular",
    "amount": 120,
    "notes": "",
    "createdAt": "2025-07-02T17:22:30.713Z"
  },
  {
    "id": "af33c2a0-da0a-4091-9f9f-17716dc3b69a",
    "name": "nicole",
    "address": "2 rivera",
    "phone": "",
    "sqft": "0",
    "billingType": "PerCut",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:07:43.305Z"
  },
  {
    "id": "bd55514e-2a97-4403-a062-44c40f31a9c1",
    "name": "8 fir",
    "address": "8 fir",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:08:12.803Z"
  },
  {
    "id": "56e0822a-5786-49a8-87f1-205f579d5280",
    "name": "7 montreux",
    "address": "7 montreux",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:07:06.748Z"
  },
  {
    "id": "58037ad3-c37d-423a-b653-708f9bde37f8",
    "name": "3 valbella",
    "address": "3 valbella",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:06:40.420Z"
  },
  {
    "id": "c3a9dd65-e470-46b7-a5b6-da3df0ec62fe",
    "name": "23 Zurich",
    "address": "23 Zurich",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-09T19:21:50.573Z"
  },
  {
    "id": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "name": "5 corino",
    "address": "5 corino",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:06:12.956Z"
  },
  {
    "id": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "name": "4 overlea",
    "address": "4 overlea",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:05:34.331Z"
  },
  {
    "id": "1eea1b2f-9b81-442e-810f-e97af8a7d4c3",
    "name": "91 southpine",
    "address": "91 southpine",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:05:10.004Z"
  },
  {
    "id": "af6ffaad-f3fd-455a-be3a-a84ad7dcaf6f",
    "name": "Shawn sim",
    "address": "3 aspenwood street",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-02T17:04:30.897Z"
  },
  {
    "id": "5e51982c-0af9-4c49-ad73-007e6a2c6708",
    "name": "55 cedargrove",
    "address": "55 cedargrove",
    "phone": "",
    "sqft": "0",
    "billingType": "Regular",
    "amount": 0,
    "notes": "",
    "createdAt": "2025-07-01T20:55:04.486Z"
  }
];
const mockSessions: Session[] = [
  {
    "id": "a71c95d1-be2d-4fa7-9db7-b62edef3d5a8",
    "type": "address-mow",
    "clientId": "a569006b-669c-4e3c-88b9-01bff9a608bd",
    "startTime": "2025-07-19T18:29:46.658Z",
    "endTime": "2025-07-19T18:38:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "8718fa76-0dd0-48dd-b7f1-84ee1831ef98",
    "type": "address-mow",
    "clientId": "30694879-913e-49fd-aa2a-1e8c9118e727",
    "startTime": "2025-08-20T18:47:10.003Z",
    "endTime": "2025-08-20T19:05:01.159Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "fd7ffad9-e9b0-4f1c-8dea-6ca7a41c5992",
    "type": "address-mow",
    "clientId": "30694879-913e-49fd-aa2a-1e8c9118e727",
    "startTime": "2025-08-12T12:49:27.781Z",
    "endTime": "2025-08-12T12:55:47.724Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "c812adea-8040-4dde-b4e7-7dfb35930229",
    "type": "address-mow",
    "clientId": "30694879-913e-49fd-aa2a-1e8c9118e727",
    "startTime": "2025-07-30T13:16:13.191Z",
    "endTime": "2025-07-30T13:35:03.774Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "281ca526-dca8-46c3-8a35-325e9097e0e2",
    "type": "address-mow",
    "clientId": "30694879-913e-49fd-aa2a-1e8c9118e727",
    "startTime": "2025-07-10T19:34:08.726Z",
    "endTime": "2025-07-10T20:07:52.692Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "c7f449b0-a93e-477e-b69a-a1a3ad0da7cd",
    "type": "address-mow",
    "clientId": "30694879-913e-49fd-aa2a-1e8c9118e727",
    "startTime": "2025-07-02T17:22:32.958Z",
    "endTime": "2025-07-02T17:39:48.339Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "3dc36573-37c3-4b8f-8a84-132880047c30",
    "type": "address-mow",
    "clientId": "af33c2a0-da0a-4091-9f9f-17716dc3b69a",
    "startTime": "2025-08-24T17:42:58.019Z",
    "endTime": "2025-08-24T17:57:07.074Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "46b22745-8758-44ca-9d60-2c42b948be9b",
    "type": "address-mow",
    "clientId": "af33c2a0-da0a-4091-9f9f-17716dc3b69a",
    "startTime": "2025-08-07T13:18:31.309Z",
    "endTime": "2025-08-07T13:38:14.030Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "d370f53b-5ff5-436b-98fd-2294f70dccaa",
    "type": "address-mow",
    "clientId": "af33c2a0-da0a-4091-9f9f-17716dc3b69a",
    "startTime": "2025-07-02T18:53:59.759Z",
    "endTime": "2025-07-02T19:07:15.534Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "3f8ef1af-0452-4541-9d2b-99ef45238be6",
    "type": "address-mow",
    "clientId": "bd55514e-2a97-4403-a062-44c40f31a9c1",
    "startTime": "2025-08-07T14:39:20.388Z",
    "endTime": "2025-08-07T15:05:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "09bea828-72ce-4513-9926-206e377c4cf3",
    "type": "address-mow",
    "clientId": "bd55514e-2a97-4403-a062-44c40f31a9c1",
    "startTime": "2025-07-02T19:10:16.730Z",
    "endTime": "2025-07-02T19:22:37.966Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "9415a5c9-abec-4b09-bacf-78edfe960aa4",
    "type": "address-mow",
    "clientId": "56e0822a-5786-49a8-87f1-205f579d5280",
    "startTime": "2025-08-24T17:12:43.486Z",
    "endTime": "2025-08-24T17:28:03.158Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "c8bd89fd-8cd0-4491-9a28-727eb7affd8c",
    "type": "address-mow",
    "clientId": "56e0822a-5786-49a8-87f1-205f579d5280",
    "startTime": "2025-08-07T13:01:02.599Z",
    "endTime": "2025-08-07T13:16:41.292Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "3127c776-56ba-4bca-88f9-adcebf55c4c8",
    "type": "address-mow",
    "clientId": "56e0822a-5786-49a8-87f1-205f579d5280",
    "startTime": "2025-07-30T17:49:47.729Z",
    "endTime": "2025-07-30T17:56:30.109Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "31b42e82-3c7a-4cdd-a246-c8149163aaef",
    "type": "address-mow",
    "clientId": "56e0822a-5786-49a8-87f1-205f579d5280",
    "startTime": "2025-07-17T13:58:23.479Z",
    "endTime": "2025-07-17T14:07:51.831Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "51175c84-3b62-441e-a33a-6d164000938b",
    "type": "address-mow",
    "clientId": "56e0822a-5786-49a8-87f1-205f579d5280",
    "startTime": "2025-07-09T19:05:32.969Z",
    "endTime": "2025-07-09T19:17:48.773Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "6af66882-668f-46c7-9c17-10701e81a346",
    "type": "address-mow",
    "clientId": "56e0822a-5786-49a8-87f1-205f579d5280",
    "startTime": "2025-07-02T18:38:56.326Z",
    "endTime": "2025-07-02T18:52:31.039Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "e56a61b5-f0eb-47fa-bf4f-618099d9ffbc",
    "type": "address-mow",
    "clientId": "58037ad3-c37d-423a-b653-708f9bde37f8",
    "startTime": "2025-08-24T17:28:36.676Z",
    "endTime": "2025-08-24T17:41:00.622Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "dc72ca9c-38f5-4411-8a7c-a96d42e0eace",
    "type": "address-mow",
    "clientId": "58037ad3-c37d-423a-b653-708f9bde37f8",
    "startTime": "2025-08-07T12:49:37.665Z",
    "endTime": "2025-08-07T13:00:44.550Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "e1c15247-f199-4284-aea5-78ef6b13e63d",
    "type": "address-mow",
    "clientId": "58037ad3-c37d-423a-b653-708f9bde37f8",
    "startTime": "2025-07-09T18:55:15.260Z",
    "endTime": "2025-07-09T19:04:45.639Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "65c4f002-a0ea-46b2-9582-d271d41f9e43",
    "type": "address-mow",
    "clientId": "58037ad3-c37d-423a-b653-708f9bde37f8",
    "startTime": "2025-07-02T18:27:52.843Z",
    "endTime": "2025-07-02T18:38:30.094Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "47a56206-21dd-45f5-b6b8-eee8c4bf7293",
    "type": "address-mow",
    "clientId": "c3a9dd65-e470-46b7-a5b6-da3df0ec62fe",
    "startTime": "2025-08-07T13:39:24.215Z",
    "endTime": "2025-08-07T14:05:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "11a1847c-412f-41db-bd02-d9a69a601a59",
    "type": "address-mow",
    "clientId": "c3a9dd65-e470-46b7-a5b6-da3df0ec62fe",
    "startTime": "2025-07-09T19:21:53.496Z",
    "endTime": "2025-07-09T19:46:51.769Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "3d9a661e-e0f7-4d9a-a298-809310467799",
    "type": "address-mow",
    "clientId": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "startTime": "2025-08-24T16:52:55.189Z",
    "endTime": "2025-08-24T17:10:36.091Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "e46fb848-75b3-4d5b-a243-d9130f568da6",
    "type": "address-mow",
    "clientId": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "startTime": "2025-08-07T12:34:59.053Z",
    "endTime": "2025-08-07T12:48:09.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "217882b6-2f22-4c57-ada6-5c618ebf4ef3",
    "type": "address-mow",
    "clientId": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "startTime": "2025-07-30T17:35:59.680Z",
    "endTime": "2025-07-30T17:49:42.261Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "48776edd-b7cd-4fed-8702-9dffe7f1f85c",
    "type": "address-mow",
    "clientId": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "startTime": "2025-07-17T13:46:31.855Z",
    "endTime": "2025-07-17T13:57:06.005Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "2533d89f-2f03-4b64-9cbd-8eacc16cf699",
    "type": "address-mow",
    "clientId": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "startTime": "2025-07-09T18:41:15.546Z",
    "endTime": "2025-07-09T18:52:36.298Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "31621839-2a4f-476d-b13e-1b18afd69296",
    "type": "address-mow",
    "clientId": "0483f063-5c00-4f62-bcb6-41d3958823bc",
    "startTime": "2025-07-02T18:24:07.113Z",
    "endTime": "2025-07-02T18:27:24.924Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "395928df-77d7-47da-8a48-861d8c75de81",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-08-29T19:01:58.550Z",
    "endTime": "2025-08-29T19:16:41.870Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "b9d1776f-f2d6-4895-ac34-a6420d930009",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-08-20T19:08:34.628Z",
    "endTime": "2025-08-20T19:19:22.948Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "802b084b-854b-4a1b-99ee-e988bcbe3d06",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-08-12T13:17:54.565Z",
    "endTime": "2025-08-12T13:32:43.565Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "9822f2af-b231-412c-aab4-82264d6d14b4",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-07-30T13:55:00.000Z",
    "endTime": "2025-07-30T14:08:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "3990f9cc-ff1a-4066-bc57-0c62e5bac003",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-07-17T13:33:07.974Z",
    "endTime": "2025-07-17T13:40:21.692Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "c53549f3-762f-4a1a-a855-b3686074f0ed",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-07-10T18:59:24.162Z",
    "endTime": "2025-07-10T19:12:39.460Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "505b4eac-efdc-435e-a87f-6b5c734190a9",
    "type": "address-mow",
    "clientId": "74419184-5b00-4a8a-b2f9-c94a8b51801c",
    "startTime": "2025-07-02T17:57:06.695Z",
    "endTime": "2025-07-02T18:10:00.796Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "2c612161-4bb4-4bf6-9638-5f82277d2838",
    "type": "address-mow",
    "clientId": "1eea1b2f-9b81-442e-810f-e97af8a7d4c3",
    "startTime": "2025-08-29T18:43:25.491Z",
    "endTime": "2025-08-29T19:01:08.615Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "df06c6ec-f44f-40a9-aa8c-7429cf9d7481",
    "type": "address-mow",
    "clientId": "1eea1b2f-9b81-442e-810f-e97af8a7d4c3",
    "startTime": "2025-08-12T12:57:46.575Z",
    "endTime": "2025-08-12T13:16:49.372Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "f903e996-2c55-444a-be56-64cb69bb0a5b",
    "type": "address-mow",
    "clientId": "1eea1b2f-9b81-442e-810f-e97af8a7d4c3",
    "startTime": "2025-07-30T13:37:46.834Z",
    "endTime": "2025-07-30T13:53:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "dee1b588-768b-4bf9-b91a-016a97b429c2",
    "type": "address-mow",
    "clientId": "1eea1b2f-9b81-442e-810f-e97af8a7d4c3",
    "startTime": "2025-07-10T19:13:59.392Z",
    "endTime": "2025-07-10T19:31:52.395Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "b062c41e-2811-4e40-951a-4c9d169cbd6b",
    "type": "address-mow",
    "clientId": "1eea1b2f-9b81-442e-810f-e97af8a7d4c3",
    "startTime": "2025-07-02T17:41:27.028Z",
    "endTime": "2025-07-02T17:56:10.561Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "30341116-1b57-4562-bb0c-0c27813b52ce",
    "type": "address-mow",
    "clientId": "af6ffaad-f3fd-455a-be3a-a84ad7dcaf6f",
    "startTime": "2025-08-29T18:30:20.269Z",
    "endTime": "2025-08-29T18:40:03.515Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "17fb3060-8241-4ec0-a625-276a037c1bd4",
    "type": "address-mow",
    "clientId": "af6ffaad-f3fd-455a-be3a-a84ad7dcaf6f",
    "startTime": "2025-08-12T12:34:57.391Z",
    "endTime": "2025-08-12T12:47:44.060Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "71ea7cdb-ba4a-44c4-8f2f-a450ea0cdf75",
    "type": "address-mow",
    "clientId": "af6ffaad-f3fd-455a-be3a-a84ad7dcaf6f",
    "startTime": "2025-07-30T13:02:32.585Z",
    "endTime": "2025-07-30T13:14:30.329Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "fcd774fd-2b89-4b28-ad5c-f10a9c90b25c",
    "type": "address-mow",
    "clientId": "af6ffaad-f3fd-455a-be3a-a84ad7dcaf6f",
    "startTime": "2025-07-17T13:13:11.293Z",
    "endTime": "2025-07-17T13:23:44.501Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "2dbe87f7-b92a-436f-b4ae-e98fa7d278df",
    "type": "address-mow",
    "clientId": "af6ffaad-f3fd-455a-be3a-a84ad7dcaf6f",
    "startTime": "2025-07-02T17:12:06.284Z",
    "endTime": "2025-07-02T17:21:17.283Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "950bbe13-6d51-4639-a7b8-4ca08ea9d77a",
    "type": "address-mow",
    "clientId": "5e51982c-0af9-4c49-ad73-007e6a2c6708",
    "startTime": "2025-07-30T14:49:00.000Z",
    "endTime": "2025-07-30T15:15:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "f0d987a0-84b9-4abe-9022-94a4283bc4e0",
    "type": "address-mow",
    "clientId": "5e51982c-0af9-4c49-ad73-007e6a2c6708",
    "startTime": "2025-07-09T20:15:19.824Z",
    "endTime": "2025-07-09T20:41:38.538Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "63f66756-4e21-40be-9273-d392628ff2fe",
    "type": "address-mow",
    "clientId": "5e51982c-0af9-4c49-ad73-007e6a2c6708",
    "startTime": "2025-07-01T20:55:08.388Z",
    "endTime": "2025-07-01T20:55:10.486Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "9b0b924d-cca5-4a88-978c-3a4861197611",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-08-29T18:28:04.650Z",
    "endTime": "2025-08-29T21:33:11.068Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "58a1b0a6-4ab9-4b84-8184-4453c053cdac",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-08-24T16:46:30.806Z",
    "endTime": "2025-08-24T19:32:47.135Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "133a6648-8116-4da7-8baa-04a67b6df03d",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-08-20T18:45:53.843Z",
    "endTime": "2025-08-21T03:48:32.949Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "f143c607-68e9-44f0-b48f-b3c7372c2d58",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-08-12T12:32:01.780Z",
    "endTime": "2025-08-12T13:39:00.652Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "93b84031-21e2-4304-981d-36ff6f935277",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-08-07T12:34:52.766Z",
    "endTime": "2025-08-07T15:10:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "7421aaf8-01a0-4f0f-b077-5e91a269cac5",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-30T17:30:00.000Z",
    "endTime": "2025-07-30T18:50:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "1a9e3991-dc4e-462b-b671-53f937da84a6",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-30T12:59:56.637Z",
    "endTime": "2025-07-30T16:47:40.265Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "81b8d8f0-9b4c-4996-83f1-8e7316cb3777",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-23T18:07:47.698Z",
    "endTime": "2025-07-23T19:30:00.000Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "6bcf15f0-cfbc-467a-9299-f754ab21080a",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-19T18:26:10.183Z",
    "endTime": "2025-07-19T21:57:41.850Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "a7d4b00d-713c-4f0e-8474-06fd9e03c971",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-17T13:09:46.212Z",
    "endTime": "2025-07-17T15:13:39.090Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "c19f0654-9068-4507-91f7-b9fb50917df0",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-10T18:53:17.223Z",
    "endTime": "2025-07-10T20:08:17.117Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "26d5ef8c-7b61-40ac-b48e-00ea716e433d",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-09T18:35:53.926Z",
    "endTime": "2025-07-09T21:05:01.080Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  },
  {
    "id": "8f0f4724-edce-46bf-b338-4ec5d1a9672a",
    "type": "workday",
    "clientId": null,
    "startTime": "2025-07-02T17:09:25.802Z",
    "endTime": "2025-07-02T19:45:11.271Z",
    "breakTimeTotal": 0,
    "stuckTimeTotal": 0,
    "status": "completed"
  }
];
const mockGasLogs: GasLog[] = [
  {
    "id": "7afd01b0-30fd-4016-8717-59b44bce3bf6",
    "date": "2025-08-16T13:00:14.988Z",
    "liters": 6.09,
    "pricePerLiter": 1.4449917898193763,
    "total": 8.8,
    "isAiScanned": false
  },
  {
    "id": "55a48f8f-57dd-4c14-8b45-c2fbdd54f4af",
    "date": "2025-08-07T14:32:23.872Z",
    "liters": 6.31,
    "pricePerLiter": 1.4374009508716326,
    "total": 9.07,
    "isAiScanned": false
  },
  {
    "id": "ce5ba44b-eb1a-484a-afaf-64e250421747",
    "date": "2025-07-17T14:38:31.778Z",
    "liters": 9.22,
    "pricePerLiter": 1.4154013015184381,
    "total": 13.05,
    "isAiScanned": false
  },
  {
    "id": "fd4b54ef-6c23-41c2-9a32-c8fc50ba3aaa",
    "date": "2025-07-09T19:53:29.783Z",
    "liters": 3.89,
    "pricePerLiter": 1.3881748071979434,
    "total": 5.4,
    "isAiScanned": false
  },
  {
    "id": "b917c4ff-e4d5-4b15-a6e9-d4a2a0f123cb",
    "date": "2025-07-02T19:27:47.456Z",
    "liters": 6.65,
    "pricePerLiter": 1.4466165413533834,
    "total": 9.62,
    "isAiScanned": false
  }
];
const mockMaintenanceLogs: MaintenanceLog[] = [];
const mockEquipment: Equipment[] = [];

export function getSeedData() {
  return {
    clients: mockClients,
    sessions: mockSessions,
    gasLogs: mockGasLogs,
    maintenanceLogs: mockMaintenanceLogs,
    equipment: mockEquipment,
    // Default home in Orlando
    homeAddress: "500 S Orange Ave, Orlando, FL",
    homeLat: 28.5355,
    homeLng: -81.3790,
    laborRate: 25,
    fuelCostPerKm: 0.15,
  };
}
