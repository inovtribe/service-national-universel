import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Col, Row } from "reactstrap";

import CircularProgress from "../components/CircularProgress";

import api from "../../../services/api";

export default ({ filter }) => {
  const [gender, setGender] = useState(null);

  useEffect(() => {
    (async () => {
      const queries = [];
      queries.push({ index: "young", type: "_doc" });
      queries.push({
        query: { bool: { must: { match_all: {} }, filter: [{ term: { "cohort.keyword": filter.cohort } }] } },
        aggs: { status: { terms: { field: "gender.keyword" } } },
        size: 0,
      });

      if (filter.status) queries[1].query.bool.filter.push({ terms: { "status.keyword": filter.status } });
      if (filter.region) queries[1].query.bool.filter.push({ term: { "region.keyword": filter.region } });
      if (filter.department) queries[1].query.bool.filter.push({ term: { "department.keyword": filter.department } });

      const { responses } = await api.esQuery(queries);
      const m = api.getAggregations(responses[0]);
      setGender(m);
    })();
  }, [JSON.stringify(filter)]);

  function render() {
    if (!gender) return <div>Loading ....</div>;

    const male = gender.male || 0;
    const female = gender.female || 0;
    const malePercent = ((male * 100) / (male + female)).toFixed(1);
    const femalePercent = ((female * 100) / (male + female)).toFixed(1);

    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <CircularProgress circleProgressColor="#1B7BBF" percentage={malePercent} title={male} subtitle="Garçons" />
        <CircularProgress circleProgressColor="#1B7BBF" percentage={femalePercent} title={female} subtitle="Filles" />
      </div>
    );
  }

  return (
    <Box>
      <BoxTitle>Sexe</BoxTitle>
      <BoxContent direction="column">{render()}</BoxContent>
    </Box>
  );
};

const Box = styled.div`
  background-color: #fff;
  filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.05));
  margin-bottom: 33px;
  border-radius: 8px;
`;
const BoxTitle = styled.h3`
  padding: 22px;
  color: #171725;
  font-size: 16px;
  font-weight: bold;
  border-bottom: 1px solid #f2f1f1;
`;
const BoxContent = styled.div`
  padding: 30px;
  display: flex;
  flex-direction: ${(props) => props.direction};
  & > * {
    ${(props) => props.direction === "column" && ` margin-bottom: 25px;`}
  }
`;
