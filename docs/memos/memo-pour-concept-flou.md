__MariaDB vs MongoDB__

__En bref__

Ce sont deux types de bases de données différents. MariaDB stocke les données dans des tableaux avec des colonnes fixes (relationnel). MongoDB stocke des documents flexibles sans structure imposée car évolutif et/ou différents formes et tailles et généralement en .json (NoSQL).

__Exemple concret__

-- MariaDB : structure rigide, mais relations possibles

CREATE TABLE utilisateurs (

    id  INT PRIMARY KEY AUTO_INCREMENT,

    nom VARCHAR(100) NOT NULL

);

CREATE TABLE recettes (

    id             INT PRIMARY KEY AUTO_INCREMENT,

    titre          VARCHAR(100) NOT NULL,

    utilisateur_id INT,

    FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)

);

-- chaque recette est liée à un utilisateur précis

-- MariaDB empêche d'avoir une recette sans auteur valide

Elle empêche également la suppression des données liés pour pas faire des orphelins 

// MongoDB : flexible, pas de liaison native

\{ "titre": "Pasta", "auteur": "Jean" \}

\{ "titre": "Pizza" \} // auteur absent, MongoDB s'en fout

__À retenir__

- MariaDB = tableaux \+ relations entre tables = cohérence garantie
- MongoDB = documents flexibles = liberté mais moins de contrôle
- FOREIGN KEY est ce qui crée la liaison entre deux tables dans MariaDB
- MongoDB est utile quand la structure des données change souvent
- Pour un exam : MariaDB = relationnel donc SQL, MongoDB = NoSQL

