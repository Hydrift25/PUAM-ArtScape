--
-- PostgreSQL database dump
--

\restrict ZwsQANTO3BhiC8AssPiT299il6BD1KMV1a2VBfmlzceGZFVuY6TmVAa6ABOV02F

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: geo_prelim; Type: TABLE; Schema: public; Owner: DevP4
--

CREATE TABLE public.geo_prelim (
    objectid integer NOT NULL,
    lat numeric,
    long numeric
);


ALTER TABLE public.geo_prelim OWNER TO "DevP4";

--
-- Data for Name: geo_prelim; Type: TABLE DATA; Schema: public; Owner: DevP4
--

INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (30593, 40.3452, -74.6517);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31205, 40.3451, -74.6519);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31239, 40.3489, -74.6575);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31285, 40.349866, -74.658273);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31339, 40.3443, -74.6593);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31352, 40.3493, -74.6575);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31393, 40.3455, -74.6522);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31408, 40.3477, -74.6569);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31413, 40.34526, -74.65198);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31416, 40.3407, -74.667);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31445, 40.3484, -74.6621);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31464, 40.3483, -74.6598);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31481, 40.3411, -74.6661);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31499, 40.3504, -74.6525);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31505, 40.3484, -74.6578);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31575, 40.3505, -74.6511);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31716, 40.3508, -74.6518);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31772, 40.3491, -74.6567);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31833, 40.3474, -74.6572);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31846, 40.3466, -74.6565);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (31937, 40.3473, -74.6573);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (32092, 40.35003, -74.65074);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (32524, 40.3483, -74.6581);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (44718, 40.3488, -74.6569);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (44722, 40.3507, -74.6509);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45145, 40.348823, -74.658688);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45158, 40.3407063, -74.6645675);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45176, 40.348698, -74.658646);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45205, 40.346976, -74.655198);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45223, 40.348682, -74.658511);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45356, 40.346000, -74.655295);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45448, 40.348776, -74.658548);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45570, 40.34854, -74.65475);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45571, 40.3487, -74.6549);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45593, 40.3507, -74.6508);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (45706, 40.3409, -74.6652);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (54819, 40.350274, -74.652014);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (55453, 40.3434, -74.6562);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (55459, 40.3462, -74.6519);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (55813, 40.3496, -74.6528);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (55830, 40.3448, -74.6585);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (55841, 40.3488, -74.6585);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (56305, 40.3486, -74.658);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (57262, 40.3486, -74.6566);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (57306, 40.3489, -74.6587);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (57751, 40.3441, -74.6558);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (57752, 40.3499, -74.6519);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (57753, 40.3506, -74.6521);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (59718, 40.3441, -74.6508);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (60520, 40.3470483, -74.6571113);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (61832, 40.3478, -74.6562);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (61850, 40.3443, -74.6531);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (62866, 40.3482, -74.6605);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (81122, 40.3435, -74.6593);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (86634, 40.3466, -74.6517);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (86951, 40.3488, -74.6594);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (86953, 40.3477, -74.6588);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (86954, 40.3469, -74.6505);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (101159, 40.3443, -74.6578);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (103470, 40.3449, -74.6579);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (107443, 40.344, -74.6489);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (112316, 40.3496, -74.6512);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (127464, 40.34919, -74.65515);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (128419, 40.34910, -74.65557);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (134355, 40.34287, -74.65934);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (136880, 40.342904, -74.659489);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (140380, 40.3426431, -74.6540633);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (140381, 40.3423081, -74.6554349);
INSERT INTO public.geo_prelim (objectid, lat, long) VALUES (140382, 40.3414408, -74.6545719);


--
-- Name: geo_prelim geo_prelim_pkey; Type: CONSTRAINT; Schema: public; Owner: DevP4
--

ALTER TABLE ONLY public.geo_prelim
    ADD CONSTRAINT geo_prelim_pkey PRIMARY KEY (objectid);


--
-- PostgreSQL database dump complete
--

\unrestrict ZwsQANTO3BhiC8AssPiT299il6BD1KMV1a2VBfmlzceGZFVuY6TmVAa6ABOV02F

