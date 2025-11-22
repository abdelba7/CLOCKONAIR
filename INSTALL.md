# CLOCK ONAIR – Guide d'installation

Ce document décrit l'installation de CLOCK ONAIR sur :

- Un **VPS Ubuntu (OVH)** – cas actuel
- Un **Raspberry Pi (migration future)**
- Un **PC local (Windows)** pour développement

---

## 1. Prérequis généraux

- Nom de domaine : `clock-onair.duckdns.org` (ou autre)
- Accès SSH à la machine
- Droits sudo

---

## 2. Installation sur VPS Ubuntu (OVH)

### 2.1. Mise à jour du système

```bash
sudo apt update
sudo apt full-upgrade -y
